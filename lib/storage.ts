import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";
import { productFieldKeys, SubmissionPayload } from "@/lib/form-config";
import { normalizeSubmission } from "@/lib/validation";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE =
  process.env.DATA_FILE_PATH || path.join(DATA_DIR, "submissions.json");
const DATABASE_URL = process.env.DATABASE_URL;

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
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
  tenant_access_token?: string;
  expire?: number;
  data?: T;
};

let sqlClient: postgres.Sql | null = null;
let tableReadyPromise: Promise<void> | null = null;
let feishuAccessTokenCache: { token: string; expiresAt: number } | null = null;

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
  return Boolean(
    FEISHU_APP_ID &&
      FEISHU_APP_SECRET &&
      FEISHU_BITABLE_APP_TOKEN &&
      FEISHU_BITABLE_TABLE_ID,
  );
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

function parseFeishuRecord(item: FeishuRecordItem): SubmissionRecord {
  const fields = item.fields || {};
  const rawPayload = normalizeUnknownText(fields[feishuFieldMap.raw_payload]);

  if (rawPayload) {
    try {
      const parsed = JSON.parse(rawPayload) as Partial<SubmissionRecord>;
      const payload = normalizeSubmission(parsed);
      const rebuilt = buildRecord(payload);

      return {
        ...rebuilt,
        id:
          typeof parsed.id === "string" && parsed.id
            ? parsed.id
            : item.record_id,
        submit_time:
          typeof parsed.submit_time === "string" && parsed.submit_time
            ? parsed.submit_time
            : rebuilt.submit_time,
        expertise_text:
          typeof parsed.expertise_text === "string"
            ? parsed.expertise_text
            : rebuilt.expertise_text,
        tracks_text:
          typeof parsed.tracks_text === "string"
            ? parsed.tracks_text
            : rebuilt.tracks_text,
        fund_companies_text:
          typeof parsed.fund_companies_text === "string"
            ? parsed.fund_companies_text
            : rebuilt.fund_companies_text,
        product_names_text:
          typeof parsed.product_names_text === "string"
            ? parsed.product_names_text
            : rebuilt.product_names_text,
        reasons_text:
          typeof parsed.reasons_text === "string"
            ? parsed.reasons_text
            : rebuilt.reasons_text,
      };
    } catch {
      return buildFallbackRecord(fields, item.record_id);
    }
  }

  return buildFallbackRecord(fields, item.record_id);
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
    feishuAccessTokenCache &&
    feishuAccessTokenCache.expiresAt > Date.now() + 60 * 1000
  ) {
    return feishuAccessTokenCache.token;
  }

  const response = await fetch(
    `${FEISHU_OPEN_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET,
      }),
      cache: "no-store",
    },
  );

  const result = (await response.json()) as FeishuResponse<unknown>;

  if (!response.ok || result.code !== 0 || !result.tenant_access_token) {
    throw new Error(
      result.message ||
        result.msg ||
        "Failed to get Feishu tenant_access_token",
    );
  }

  feishuAccessTokenCache = {
    token: result.tenant_access_token,
    expiresAt: Date.now() + (result.expire || 7200) * 1000,
  };

  return result.tenant_access_token;
}

async function feishuRequest<T>(
  pathname: string,
  init?: RequestInit,
): Promise<FeishuResponse<T>> {
  const token = await getFeishuTenantAccessToken();
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
    throw new Error(result.message || result.msg || "Feishu API request failed");
  }

  return result;
}

async function getFeishuSubmissions(): Promise<SubmissionRecord[]> {
  if (!isFeishuConfigured() || !FEISHU_BITABLE_APP_TOKEN || !FEISHU_BITABLE_TABLE_ID) {
    return [];
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

  await feishuRequest(
    `/open-apis/bitable/v1/apps/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records`,
    {
      method: "POST",
      body: JSON.stringify({
        fields: {
          [feishuFieldMap.id]: record.id,
          [feishuFieldMap.code]: record.code,
          [feishuFieldMap.submit_time]: record.submit_time,
          [feishuFieldMap.nickname]: record.nickname,
          [feishuFieldMap.follower_level]: record.follower_level,
          [feishuFieldMap.expertise_text]: record.expertise_text,
          [feishuFieldMap.tracks_text]: record.tracks_text,
          [feishuFieldMap.fund_companies_text]: record.fund_companies_text,
          [feishuFieldMap.product_names_text]: record.product_names_text,
          [feishuFieldMap.reasons_text]: record.reasons_text,
          [feishuFieldMap.raw_payload]: JSON.stringify(record),
        },
      }),
    },
  );

  return record;
}

export function getStorageInfo(): StorageInfo {
  if (isFeishuConfigured()) {
    return {
      mode: "feishu",
      label: "飞书多维表格",
      location: "FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID",
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
    return getFeishuSubmissions();
  }

  if (DATABASE_URL) {
    return getPostgresSubmissions();
  }

  return getFileSubmissions();
}

export async function appendSubmission(payload: SubmissionPayload) {
  if (isFeishuConfigured()) {
    return appendFeishuSubmission(payload);
  }

  if (DATABASE_URL) {
    return appendPostgresSubmission(payload);
  }

  return appendFileSubmission(payload);
}
