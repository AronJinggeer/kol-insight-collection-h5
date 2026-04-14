import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";
import {
  fetchFeishuAppAccessToken,
  fetchFeishuTenantAccessToken,
  getFeishuAuthMode,
  getFeishuUserTokenStrategy,
  isFeishuStorageConfigured,
  mapFeishuMatrixRows,
  refreshFeishuUserAccessToken,
} from "@/lib/feishu-auth";
import { productFieldKeys, SubmissionPayload } from "@/lib/form-config";
import { normalizeSubmission } from "@/lib/validation";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE =
  process.env.DATA_FILE_PATH || path.join(DATA_DIR, "submissions.json");
const DATABASE_URL = process.env.DATABASE_URL;

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_USER_ACCESS_TOKEN = process.env.FEISHU_USER_ACCESS_TOKEN;
const FEISHU_USER_REFRESH_TOKEN = process.env.FEISHU_USER_REFRESH_TOKEN;
const FEISHU_BITABLE_APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN;
const FEISHU_BITABLE_TABLE_ID = process.env.FEISHU_BITABLE_TABLE_ID;
const FEISHU_OPEN_BASE_URL =
  process.env.FEISHU_OPEN_BASE_URL || "https://open.feishu.cn";

const feishuFieldMap = {
  id: "id",
  code: "code",
  submit_time: "submit_time",
  nickname: "nickname",
  follower_level: "follower_level",
  expertise_text: "expertise_text",
  tracks_text: "tracks_text",
  fund_companies_text: "fund_companies_text",
  product_names_text: "product_names_text",
  reasons_text: "reasons_text",
  raw_payload: "raw_payload",
} as const;

export type SubmissionRecord = SubmissionPayload & {
  id: string;
  submit_time: string;
  expertise_text: string;
  tracks_text: string;
  fund_companies_text: string;
  product_names_text: string;
  reasons_text: string;
};

export type StorageInfo = {
  mode: "file" | "postgres" | "feishu";
  label: string;
  location: string;
  persistent: boolean;
};

type FeishuRecordItem = {
  record_id: string;
  fields?: Record<string, unknown>;
};

type FeishuResponse<T> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

type FeishuBatchCreateBody = {
  fields: string[];
  rows: Array<Array<string | null>>;
};

let sqlClient: postgres.Sql | null = null;
let tableReadyPromise: Promise<void> | null = null;
let feishuAppAccessTokenCache: { token: string; expiresAt: number } | null = null;
let feishuTenantAccessTokenCache: { token: string; expiresAt: number } | null = null;
let feishuFallbackError: string | null = null;
let feishuUserAccessTokenCache:
  | {
      token: string;
      refreshToken: string;
      expiresAt: number;
      refreshExpiresAt: number;
    }
  | null = null;

export function buildFeishuBatchCreateRequest(
  appToken: string,
  tableId: string,
  record: SubmissionRecord,
) {
  const body: FeishuBatchCreateBody = {
    fields: [
      feishuFieldMap.id,
      feishuFieldMap.code,
      feishuFieldMap.submit_time,
      feishuFieldMap.nickname,
      feishuFieldMap.follower_level,
      feishuFieldMap.expertise_text,
      feishuFieldMap.tracks_text,
      feishuFieldMap.fund_companies_text,
      feishuFieldMap.product_names_text,
      feishuFieldMap.reasons_text,
      feishuFieldMap.raw_payload,
    ],
    rows: [
      [
        record.id,
        record.code,
        record.submit_time,
        record.nickname,
        record.follower_level,
        record.expertise_text,
        record.tracks_text,
        record.fund_companies_text,
        record.product_names_text || null,
        record.reasons_text,
        JSON.stringify(record),
      ],
    ],
  };

  return {
    pathname: `/open-apis/base/v3/bases/${appToken}/tables/${tableId}/records/batch_create`,
    body,
  };
}

function buildRecord(payload: SubmissionPayload): SubmissionRecord {
  return {
    ...payload,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submit_time: new Date().toISOString(),
    expertise_text: payload.expertise.join("，"),
    tracks_text: payload.tracks.join("，"),
    fund_companies_text: payload.fund_companies.join("，"),
    product_names_text: productFieldKeys
      .map((key) => payload[key])
      .filter(Boolean)
      .join("，"),
    reasons_text: payload.reasons.join("，"),
  };
}

function isFeishuConfigured() {
  return isFeishuStorageConfigured({
    userAccessToken: FEISHU_USER_ACCESS_TOKEN,
    userRefreshToken: FEISHU_USER_REFRESH_TOKEN,
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    appToken: FEISHU_BITABLE_APP_TOKEN,
    tableId: FEISHU_BITABLE_TABLE_ID,
  });
}

function splitTextValues(value: string) {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUnknownText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      )
      .join("，");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return "";
}

function buildFallbackRecord(
  fields: Record<string, unknown>,
  recordId: string,
): SubmissionRecord {
  const productNames = splitTextValues(
    normalizeUnknownText(fields[feishuFieldMap.product_names_text]),
  );
  const payload = normalizeSubmission({
    code: normalizeUnknownText(fields[feishuFieldMap.code]),
    nickname: normalizeUnknownText(fields[feishuFieldMap.nickname]),
    expertise: splitTextValues(
      normalizeUnknownText(fields[feishuFieldMap.expertise_text]),
    ),
    expertise_other: "",
    follower_level: normalizeUnknownText(fields[feishuFieldMap.follower_level]),
    tracks: splitTextValues(normalizeUnknownText(fields[feishuFieldMap.tracks_text])),
    tracks_other: "",
    fund_companies: splitTextValues(
      normalizeUnknownText(fields[feishuFieldMap.fund_companies_text]),
    ),
    fund_companies_other: "",
    product_name_1: productNames[0] || "",
    product_name_2: productNames[1] || "",
    product_name_3: productNames[2] || "",
    product_name_4: productNames[3] || "",
    product_name_5: productNames[4] || "",
    product_name_6: productNames[5] || "",
    reasons: splitTextValues(normalizeUnknownText(fields[feishuFieldMap.reasons_text])),
    reasons_other: "",
  });

  return {
    ...buildRecord(payload),
    id: normalizeUnknownText(fields[feishuFieldMap.id]) || recordId,
    submit_time:
      normalizeUnknownText(fields[feishuFieldMap.submit_time]) ||
      new Date().toISOString(),
  };
}

function parseStoredFields(
  fields: Record<string, unknown>,
  recordId: string,
): SubmissionRecord {
  const rawPayload = normalizeUnknownText(fields[feishuFieldMap.raw_payload]);

  if (rawPayload) {
    try {
      const parsed = JSON.parse(rawPayload) as Partial<SubmissionRecord>;
      const fallback = buildFallbackRecord(fields, recordId);
      const payload = normalizeSubmission({
        ...fallback,
        ...parsed,
      });
      const rebuilt = buildRecord(payload);

      return {
        ...fallback,
        ...rebuilt,
        id:
          typeof parsed.id === "string" && parsed.id
            ? parsed.id
            : fallback.id,
        submit_time:
          typeof parsed.submit_time === "string" && parsed.submit_time
            ? parsed.submit_time
            : fallback.submit_time,
        expertise_text:
          typeof parsed.expertise_text === "string"
            ? parsed.expertise_text
            : fallback.expertise_text,
        tracks_text:
          typeof parsed.tracks_text === "string"
            ? parsed.tracks_text
            : fallback.tracks_text,
        fund_companies_text:
          typeof parsed.fund_companies_text === "string"
            ? parsed.fund_companies_text
            : fallback.fund_companies_text,
        product_names_text:
          typeof parsed.product_names_text === "string"
            ? parsed.product_names_text
            : fallback.product_names_text,
        reasons_text:
          typeof parsed.reasons_text === "string"
            ? parsed.reasons_text
            : fallback.reasons_text,
      };
    } catch {
      return buildFallbackRecord(fields, recordId);
    }
  }

  return buildFallbackRecord(fields, recordId);
}

function parseFeishuRecord(item: FeishuRecordItem): SubmissionRecord {
  return parseStoredFields(item.fields || {}, item.record_id);
}

function getSqlClient() {
  if (!DATABASE_URL) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(DATABASE_URL, {
      ssl: "require",
      max: 1,
    });
  }

  return sqlClient;
}

async function ensurePostgresTable() {
  const sql = getSqlClient();

  if (!sql) {
    return;
  }

  if (!tableReadyPromise) {
    tableReadyPromise = sql`
      create table if not exists submissions (
        id text primary key,
        submit_time timestamptz not null,
        code text not null default '',
        nickname text not null default '',
        expertise jsonb not null default '[]'::jsonb,
        expertise_other text not null default '',
        follower_level text not null default '',
        tracks jsonb not null default '[]'::jsonb,
        tracks_other text not null default '',
        fund_companies jsonb not null default '[]'::jsonb,
        fund_companies_other text not null default '',
        product_name_1 text not null default '',
        product_name_2 text not null default '',
        product_name_3 text not null default '',
        product_name_4 text not null default '',
        product_name_5 text not null default '',
        product_name_6 text not null default '',
        reasons jsonb not null default '[]'::jsonb,
        reasons_other text not null default '',
        expertise_text text not null default '',
        tracks_text text not null default '',
        fund_companies_text text not null default '',
        product_names_text text not null default '',
        reasons_text text not null default ''
      )
    `.then(() => undefined);
  }

  await tableReadyPromise;
}

async function ensureFileStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function getFileSubmissions(): Promise<SubmissionRecord[]> {
  await ensureFileStorage();
  const content = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(content) as SubmissionRecord[];
}

async function appendFileSubmission(payload: SubmissionPayload) {
  const records = await getFileSubmissions();
  const record = buildRecord(payload);

  records.unshift(record);
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf-8");

  return record;
}

async function getPostgresSubmissions(): Promise<SubmissionRecord[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  await ensurePostgresTable();

  const rows = await sql<SubmissionRecord[]>`
    select
      id,
      submit_time,
      code,
      nickname,
      expertise,
      expertise_other,
      follower_level,
      tracks,
      tracks_other,
      fund_companies,
      fund_companies_other,
      product_name_1,
      product_name_2,
      product_name_3,
      product_name_4,
      product_name_5,
      product_name_6,
      reasons,
      reasons_other,
      expertise_text,
      tracks_text,
      fund_companies_text,
      product_names_text,
      reasons_text
    from submissions
    order by submit_time desc
  `;

  return rows.map((row) => ({
    ...row,
    expertise: Array.isArray(row.expertise) ? row.expertise : [],
    tracks: Array.isArray(row.tracks) ? row.tracks : [],
    fund_companies: Array.isArray(row.fund_companies)
      ? row.fund_companies
      : [],
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    submit_time: new Date(row.submit_time).toISOString(),
  }));
}

async function appendPostgresSubmission(payload: SubmissionPayload) {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured");
  }

  await ensurePostgresTable();

  const record = buildRecord(payload);

  await sql`
    insert into submissions (
      id,
      submit_time,
      code,
      nickname,
      expertise,
      expertise_other,
      follower_level,
      tracks,
      tracks_other,
      fund_companies,
      fund_companies_other,
      product_name_1,
      product_name_2,
      product_name_3,
      product_name_4,
      product_name_5,
      product_name_6,
      reasons,
      reasons_other,
      expertise_text,
      tracks_text,
      fund_companies_text,
      product_names_text,
      reasons_text
    ) values (
      ${record.id},
      ${record.submit_time},
      ${record.code},
      ${record.nickname},
      ${JSON.stringify(record.expertise)}::jsonb,
      ${record.expertise_other},
      ${record.follower_level},
      ${JSON.stringify(record.tracks)}::jsonb,
      ${record.tracks_other},
      ${JSON.stringify(record.fund_companies)}::jsonb,
      ${record.fund_companies_other},
      ${record.product_name_1},
      ${record.product_name_2},
      ${record.product_name_3},
      ${record.product_name_4},
      ${record.product_name_5},
      ${record.product_name_6},
      ${JSON.stringify(record.reasons)}::jsonb,
      ${record.reasons_other},
      ${record.expertise_text},
      ${record.tracks_text},
      ${record.fund_companies_text},
      ${record.product_names_text},
      ${record.reasons_text}
    )
  `;

  return record;
}

async function getFeishuTenantAccessToken() {
  if (!isFeishuConfigured() || !FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error("Feishu credentials are not fully configured");
  }

  if (
    feishuTenantAccessTokenCache &&
    feishuTenantAccessTokenCache.expiresAt > Date.now() + 60 * 1000
  ) {
    return feishuTenantAccessTokenCache.token;
  }

  const result = await fetchFeishuTenantAccessToken({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    openBaseUrl: FEISHU_OPEN_BASE_URL,
  });

  feishuTenantAccessTokenCache = result;

  return result.token;
}

async function getFeishuAppAccessToken() {
  if (!isFeishuConfigured() || !FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error("Feishu app credentials are not fully configured");
  }

  if (
    feishuAppAccessTokenCache &&
    feishuAppAccessTokenCache.expiresAt > Date.now() + 60 * 1000
  ) {
    return feishuAppAccessTokenCache.token;
  }

  const result = await fetchFeishuAppAccessToken({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    openBaseUrl: FEISHU_OPEN_BASE_URL,
  });

  feishuAppAccessTokenCache = result;
  return result.token;
}

async function getFeishuUserAccessToken(options: { forceRefresh?: boolean } = {}) {
  if (
    feishuUserAccessTokenCache &&
    feishuUserAccessTokenCache.expiresAt > Date.now() + 60 * 1000
  ) {
    return feishuUserAccessTokenCache.token;
  }

  if (!options.forceRefresh && FEISHU_USER_ACCESS_TOKEN) {
    return FEISHU_USER_ACCESS_TOKEN;
  }

  if (
    FEISHU_USER_REFRESH_TOKEN &&
    FEISHU_APP_ID &&
    FEISHU_APP_SECRET
  ) {
    const appAccessToken = await getFeishuAppAccessToken();
    const result = await refreshFeishuUserAccessToken({
      appAccessToken,
      refreshToken:
        feishuUserAccessTokenCache?.refreshToken || FEISHU_USER_REFRESH_TOKEN,
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      openBaseUrl: FEISHU_OPEN_BASE_URL,
    });

    feishuUserAccessTokenCache = result;
    return result.token;
  }

  throw new Error("Feishu user auth mode is not configured");
}

async function getFeishuAccessToken(
  options: { forceRefreshUserToken?: boolean } = {},
) {
  const mode = getFeishuAuthMode({
    userAccessToken: FEISHU_USER_ACCESS_TOKEN,
    userRefreshToken: FEISHU_USER_REFRESH_TOKEN,
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
  });

  if (mode === "user") {
    return getFeishuUserAccessToken({
      forceRefresh: options.forceRefreshUserToken,
    });
  }

  if (mode === "tenant") {
    return getFeishuTenantAccessToken();
  }

  throw new Error("Feishu auth mode is not configured");
}

async function feishuRequest<T>(
  pathname: string,
  init?: RequestInit,
  options: { retryOnAuthError?: boolean; forceRefreshUserToken?: boolean } = {},
): Promise<FeishuResponse<T>> {
  const token = await getFeishuAccessToken({
    forceRefreshUserToken: options.forceRefreshUserToken,
  });
  const response = await fetch(`${FEISHU_OPEN_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const result = (await response.json()) as FeishuResponse<T>;

  if (!response.ok || result.code !== 0) {
    const message =
      result.message || result.msg || "Feishu API request failed";
    const authMode = getFeishuAuthMode({
      userAccessToken: FEISHU_USER_ACCESS_TOKEN,
      userRefreshToken: FEISHU_USER_REFRESH_TOKEN,
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
    });
    const userTokenStrategy = getFeishuUserTokenStrategy({
      userAccessToken: FEISHU_USER_ACCESS_TOKEN,
      userRefreshToken: FEISHU_USER_REFRESH_TOKEN,
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
    });
    const canRetryWithRefresh =
      options.retryOnAuthError !== false &&
      authMode === "user" &&
      userTokenStrategy === "accessToken" &&
      Boolean(FEISHU_USER_REFRESH_TOKEN && FEISHU_APP_ID && FEISHU_APP_SECRET) &&
      /token\s*expire|access[_\s-]*token|invalid[_\s-]*grant|invalid[_\s-]*access/i.test(
        message,
      );

    if (canRetryWithRefresh) {
      feishuUserAccessTokenCache = null;
      return feishuRequest<T>(pathname, init, {
        retryOnAuthError: false,
        forceRefreshUserToken: true,
      });
    }

    throw new Error(message);
  }

  return result;
}

async function getFeishuSubmissions(): Promise<SubmissionRecord[]> {
  if (!isFeishuConfigured() || !FEISHU_BITABLE_APP_TOKEN || !FEISHU_BITABLE_TABLE_ID) {
    return [];
  }

  const authMode = getFeishuAuthMode({
    userAccessToken: FEISHU_USER_ACCESS_TOKEN,
    userRefreshToken: FEISHU_USER_REFRESH_TOKEN,
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
  });

  if (authMode === "user") {
    const rows: SubmissionRecord[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const query = new URLSearchParams({
        limit: "200",
        offset: String(offset),
      });

      const result = await feishuRequest<{
        data?: unknown[][];
        fields?: string[];
        has_more?: boolean;
      }>(
        `/open-apis/base/v3/bases/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records?${query.toString()}`,
        {
          method: "GET",
        },
      );

      const fieldNames = result.data?.fields || [];
      const matrixRows = result.data?.data || [];
      const mappedRows = mapFeishuMatrixRows(fieldNames, matrixRows);

      rows.push(
        ...mappedRows.map((fields, index) =>
          parseStoredFields(
            fields,
            normalizeUnknownText(fields[feishuFieldMap.id]) ||
              `base-row-${offset + index}`,
          ),
        ),
      );

      hasMore = Boolean(result.data?.has_more);
      offset += mappedRows.length;
    }

    return rows.sort((a, b) => b.submit_time.localeCompare(a.submit_time));
  }

  const items: FeishuRecordItem[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const query = new URLSearchParams({
      page_size: "500",
    });

    if (pageToken) {
      query.set("page_token", pageToken);
    }

    const result = await feishuRequest<{
      has_more?: boolean;
      page_token?: string;
      items?: FeishuRecordItem[];
    }>(
      `/open-apis/bitable/v1/apps/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records?${query.toString()}`,
      {
        method: "GET",
      },
    );

    items.push(...(result.data?.items || []));
    hasMore = Boolean(result.data?.has_more);
    pageToken = result.data?.page_token || "";
  }

  return items
    .map((item) => parseFeishuRecord(item))
    .sort((a, b) => b.submit_time.localeCompare(a.submit_time));
}

async function appendFeishuSubmission(payload: SubmissionPayload) {
  if (!isFeishuConfigured() || !FEISHU_BITABLE_APP_TOKEN || !FEISHU_BITABLE_TABLE_ID) {
    throw new Error("Feishu Bitable env vars are not fully configured");
  }

  const record = buildRecord(payload);
  const request = buildFeishuBatchCreateRequest(
    FEISHU_BITABLE_APP_TOKEN,
    FEISHU_BITABLE_TABLE_ID,
    record,
  );

  await feishuRequest(
    request.pathname,
    {
      method: "POST",
      body: JSON.stringify(request.body),
    },
  );

  return record;
}

export function getStorageInfo(): StorageInfo {
  if (feishuFallbackError) {
    return {
      mode: "file",
      label: "本地 JSON 文件（飞书回退）",
      location: DATA_FILE,
      persistent: false,
    };
  }

  if (isFeishuConfigured()) {
    const authMode = getFeishuAuthMode({
      userAccessToken: FEISHU_USER_ACCESS_TOKEN,
      userRefreshToken: FEISHU_USER_REFRESH_TOKEN,
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
    });

    return {
      mode: "feishu",
      label:
        authMode === "user"
          ? "飞书多维表格（用户授权）"
          : "飞书多维表格",
      location:
        authMode === "user"
          ? "FEISHU_USER_ACCESS_TOKEN / FEISHU_USER_REFRESH_TOKEN / FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID"
          : "FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID",
      persistent: true,
    };
  }

  if (DATABASE_URL) {
    return {
      mode: "postgres",
      label: "Postgres 数据库",
      location: "DATABASE_URL",
      persistent: true,
    };
  }

  return {
    mode: "file",
    label: "本地 JSON 文件",
    location: DATA_FILE,
    persistent: false,
  };
}

export async function getSubmissions(): Promise<SubmissionRecord[]> {
  if (isFeishuConfigured()) {
    try {
      const submissions = await getFeishuSubmissions();
      feishuFallbackError = null;
      return submissions;
    } catch (error) {
      feishuFallbackError =
        error instanceof Error ? error.message : "unknown feishu read error";
      console.error("feishu read failed, falling back to file storage", error);
      return getFileSubmissions();
    }
  }

  if (DATABASE_URL) {
    return getPostgresSubmissions();
  }

  return getFileSubmissions();
}

export async function appendSubmission(payload: SubmissionPayload) {
  if (isFeishuConfigured()) {
    try {
      const record = await appendFeishuSubmission(payload);
      feishuFallbackError = null;
      return record;
    } catch (error) {
      feishuFallbackError =
        error instanceof Error ? error.message : "unknown feishu write error";
      console.error("feishu write failed, falling back to file storage", error);
      return appendFileSubmission(payload);
    }
  }

  if (DATABASE_URL) {
    return appendPostgresSubmission(payload);
  }

  return appendFileSubmission(payload);
}
