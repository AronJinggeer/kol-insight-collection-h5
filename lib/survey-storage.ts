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
import type {
  Product,
  KOL,
  SurveyResponseBundle,
  SurveyResponse,
  SurveyResponseItem,
  SurveySubmitPayload,
} from "./survey-types.ts";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PRODUCTS_FILE =
  process.env.SURVEY_PRODUCTS_FILE || path.join(DATA_DIR, "products.json");
const RESPONSES_FILE =
  process.env.SURVEY_RESPONSES_FILE ||
  path.join(DATA_DIR, "survey-responses.json");
const DATABASE_URL = process.env.DATABASE_URL;
const SURVEY_REQUIRE_DATABASE = process.env.SURVEY_REQUIRE_DATABASE === "true";
const SURVEY_REQUIRE_PERSISTENT_STORAGE =
  process.env.SURVEY_REQUIRE_PERSISTENT_STORAGE === "true" ||
  (process.env.SURVEY_REQUIRE_PERSISTENT_STORAGE !== "false" &&
    process.env.NODE_ENV === "production");
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_USER_ACCESS_TOKEN = process.env.FEISHU_USER_ACCESS_TOKEN;
const FEISHU_USER_REFRESH_TOKEN = process.env.FEISHU_USER_REFRESH_TOKEN;
const FEISHU_BITABLE_APP_TOKEN =
  process.env.SURVEY_FEISHU_BITABLE_APP_TOKEN ||
  process.env.FEISHU_BITABLE_APP_TOKEN;
const FEISHU_BITABLE_TABLE_ID =
  process.env.SURVEY_FEISHU_BITABLE_TABLE_ID ||
  process.env.FEISHU_BITABLE_TABLE_ID;
const FEISHU_OPEN_BASE_URL =
  process.env.FEISHU_OPEN_BASE_URL || "https://open.feishu.cn";

let sqlClient: postgres.Sql | null = null;
let surveyTablesReadyPromise: Promise<void> | null = null;
let surveyFileMigrationPromise: Promise<void> | null = null;
let feishuAppAccessTokenCache: { token: string; expiresAt: number } | null = null;
let feishuTenantAccessTokenCache: { token: string; expiresAt: number } | null = null;
let feishuUserAccessTokenCache:
  | {
      token: string;
      refreshToken: string;
      expiresAt: number;
      refreshExpiresAt: number;
    }
  | null = null;

type FeishuResponse<T> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

const feishuFieldMap = {
  id: "id",
  code: "code",
  submitTime: "submit_time",
  nickname: "nickname",
  followerLevel: "follower_level",
  expertiseText: "expertise_text",
  tracksText: "tracks_text",
  fundCompaniesText: "fund_companies_text",
  productNamesText: "product_names_text",
  reasonsText: "reasons_text",
  rawPayload: "raw_payload",
} as const;

async function ensureDataFile(filePath: string, fallback: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, fallback, "utf8");
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDataFile(filePath, JSON.stringify(fallback, null, 2));
  const content = await fs.readFile(filePath, "utf8");
  if (!content.trim()) {
    return fallback;
  }
  return JSON.parse(content) as T;
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

async function getFeishuAppAccessToken() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error("Feishu app credentials are not configured");
  }

  if (
    feishuAppAccessTokenCache &&
    feishuAppAccessTokenCache.expiresAt > Date.now() + 60 * 1000
  ) {
    return feishuAppAccessTokenCache.token;
  }

  feishuAppAccessTokenCache = await fetchFeishuAppAccessToken({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    openBaseUrl: FEISHU_OPEN_BASE_URL,
  });
  return feishuAppAccessTokenCache.token;
}

async function getFeishuTenantAccessToken() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error("Feishu tenant credentials are not configured");
  }

  if (
    feishuTenantAccessTokenCache &&
    feishuTenantAccessTokenCache.expiresAt > Date.now() + 60 * 1000
  ) {
    return feishuTenantAccessTokenCache.token;
  }

  feishuTenantAccessTokenCache = await fetchFeishuTenantAccessToken({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    openBaseUrl: FEISHU_OPEN_BASE_URL,
  });
  return feishuTenantAccessTokenCache.token;
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

  if (FEISHU_USER_REFRESH_TOKEN && FEISHU_APP_ID && FEISHU_APP_SECRET) {
    const appAccessToken = await getFeishuAppAccessToken();
    feishuUserAccessTokenCache = await refreshFeishuUserAccessToken({
      appAccessToken,
      refreshToken:
        feishuUserAccessTokenCache?.refreshToken || FEISHU_USER_REFRESH_TOKEN,
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      openBaseUrl: FEISHU_OPEN_BASE_URL,
    });
    return feishuUserAccessTokenCache.token;
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
    const message = result.message || result.msg || "Feishu API request failed";
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

function serializeSurveyBundle(bundle: SurveyResponseBundle) {
  return JSON.stringify({
    surveySchemaVersion: 1,
    bundle,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSurveyResponseBundle(value: unknown): value is SurveyResponseBundle {
  if (!isRecord(value)) return false;

  const kol = value.kol;
  const response = value.response;
  const items = value.items;
  if (!isRecord(kol) || !isRecord(response) || !Array.isArray(items)) {
    return false;
  }

  if (
    typeof kol.id !== "string" ||
    typeof kol.name !== "string" ||
    !isStringArray(kol.platforms) ||
    typeof kol.followerRange !== "string" ||
    !isStringArray(kol.contentDirections)
  ) {
    return false;
  }

  if (
    typeof response.id !== "string" ||
    typeof response.kolId !== "string" ||
    response.status !== "submitted" ||
    typeof response.submittedAt !== "string"
  ) {
    return false;
  }

  return items.every((item) => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.responseId === "string" &&
      typeof item.productId === "string" &&
      typeof item.interestLevel === "string" &&
      typeof item.rankType === "string" &&
      isStringArray(item.contentFormats)
    );
  });
}

function parseSurveyBundleFromRawPayload(rawPayload: unknown) {
  if (typeof rawPayload !== "string" || !rawPayload.trim()) return null;
  try {
    const parsed = JSON.parse(rawPayload) as {
      surveySchemaVersion?: number;
      bundle?: unknown;
    };
    if (
      parsed.surveySchemaVersion !== 1 ||
      !isSurveyResponseBundle(parsed.bundle)
    ) {
      return null;
    }
    return parsed.bundle;
  } catch {
    return null;
  }
}

function buildFeishuSurveyBatchCreateBody(bundle: SurveyResponseBundle) {
  return {
    fields: [
      feishuFieldMap.id,
      feishuFieldMap.code,
      feishuFieldMap.submitTime,
      feishuFieldMap.nickname,
      feishuFieldMap.followerLevel,
      feishuFieldMap.expertiseText,
      feishuFieldMap.tracksText,
      feishuFieldMap.fundCompaniesText,
      feishuFieldMap.productNamesText,
      feishuFieldMap.reasonsText,
      feishuFieldMap.rawPayload,
    ],
    rows: [
      [
        bundle.response.id,
        "survey",
        bundle.response.submittedAt,
        bundle.kol.name,
        bundle.kol.followerRange,
        bundle.kol.contentDirections.join("，"),
        bundle.kol.platforms.join("，"),
        "5-6月行情调研",
        bundle.items.map((item) => item.productId).join("，"),
        bundle.items
          .map((item) => item.personalReason)
          .filter(Boolean)
          .join("，"),
        serializeSurveyBundle(bundle),
      ],
    ],
  };
}

async function appendFeishuSurveyBundle(bundle: SurveyResponseBundle) {
  if (!FEISHU_BITABLE_APP_TOKEN || !FEISHU_BITABLE_TABLE_ID) {
    throw new Error("Feishu Bitable env vars are not fully configured");
  }

  await feishuRequest(
    `/open-apis/base/v3/bases/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records/batch_create`,
    {
      method: "POST",
      body: JSON.stringify(buildFeishuSurveyBatchCreateBody(bundle)),
    },
  );
}

async function getFeishuSurveyBundles() {
  if (!FEISHU_BITABLE_APP_TOKEN || !FEISHU_BITABLE_TABLE_ID) {
    return [];
  }

  const authMode = getFeishuAuthMode({
    userAccessToken: FEISHU_USER_ACCESS_TOKEN,
    userRefreshToken: FEISHU_USER_REFRESH_TOKEN,
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
  });

  const bundles: SurveyResponseBundle[] = [];
  if (authMode === "user") {
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
        { method: "GET" },
      );
      const fieldNames = result.data?.fields || [];
      const matrixRows = result.data?.data || [];
      const mappedRows = mapFeishuMatrixRows(fieldNames, matrixRows);
      bundles.push(
        ...mappedRows
          .map((row) => parseSurveyBundleFromRawPayload(row[feishuFieldMap.rawPayload]))
          .filter((bundle): bundle is SurveyResponseBundle => Boolean(bundle)),
      );
      hasMore = Boolean(result.data?.has_more);
      offset += mappedRows.length;
    }
  } else {
    let pageToken = "";
    let hasMore = true;
    while (hasMore) {
      const query = new URLSearchParams({ page_size: "500" });
      if (pageToken) query.set("page_token", pageToken);
      const result = await feishuRequest<{
        has_more?: boolean;
        page_token?: string;
        items?: Array<{ fields?: Record<string, unknown> }>;
      }>(
        `/open-apis/bitable/v1/apps/${FEISHU_BITABLE_APP_TOKEN}/tables/${FEISHU_BITABLE_TABLE_ID}/records?${query.toString()}`,
        { method: "GET" },
      );
      bundles.push(
        ...(result.data?.items || [])
          .map((item) =>
            parseSurveyBundleFromRawPayload(item.fields?.[feishuFieldMap.rawPayload]),
          )
          .filter((bundle): bundle is SurveyResponseBundle => Boolean(bundle)),
      );
      hasMore = Boolean(result.data?.has_more);
      pageToken = result.data?.page_token || "";
    }
  }

  return bundles.sort((a, b) =>
    b.response.submittedAt.localeCompare(a.response.submittedAt),
  );
}

function getSqlClient() {
  if (!DATABASE_URL) {
    if (SURVEY_REQUIRE_DATABASE) {
      throw new Error("DATABASE_URL is not configured");
    }
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(DATABASE_URL, {
      max: 1,
      ssl: DATABASE_URL.includes("localhost") ? false : "require",
    });
  }

  return sqlClient;
}

async function ensureSurveyTables() {
  const sql = getSqlClient();
  if (!sql) return null;

  if (!surveyTablesReadyPromise) {
    surveyTablesReadyPromise = (async () => {
      await sql`
        create table if not exists survey_kols (
          id text primary key,
          name text not null,
          platforms jsonb not null default '[]'::jsonb,
          follower_range text not null,
          content_directions jsonb not null default '[]'::jsonb,
          created_at timestamptz not null,
          updated_at timestamptz not null
        )
      `;
      await sql`
        create table if not exists survey_responses (
          id text primary key,
          kol_id text not null references survey_kols(id) on delete cascade,
          status text not null,
          submitted_at timestamptz not null,
          confirmed_intent_only boolean not null,
          confirmed_compliance boolean not null,
          confirmed_final_communication boolean not null,
          created_at timestamptz not null,
          updated_at timestamptz not null
        )
      `;
      await sql`
        create table if not exists survey_response_items (
          id text primary key,
          response_id text not null references survey_responses(id) on delete cascade,
          product_id text not null,
          interest_level text not null,
          rank_type text not null,
          personal_reason text not null default '',
          content_formats jsonb not null default '[]'::jsonb,
          remark text not null default '',
          created_at timestamptz not null,
          updated_at timestamptz not null
        )
      `;
      await sql`
        create index if not exists survey_responses_submitted_at_idx
        on survey_responses (submitted_at desc)
      `;
      await sql`
        create index if not exists survey_response_items_product_id_idx
        on survey_response_items (product_id)
      `;
    })();
  }

  await surveyTablesReadyPromise;
  return sql;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function insertSurveyBundle(
  sql: postgres.Sql,
  bundle: SurveyResponseBundle,
) {
  await sql.begin(async (transaction) => {
    await transaction`
      insert into survey_kols (
        id,
        name,
        platforms,
        follower_range,
        content_directions,
        created_at,
        updated_at
      ) values (
        ${bundle.kol.id},
        ${bundle.kol.name},
        ${JSON.stringify(bundle.kol.platforms)}::jsonb,
        ${bundle.kol.followerRange},
        ${JSON.stringify(bundle.kol.contentDirections)}::jsonb,
        ${bundle.kol.createdAt},
        ${bundle.kol.updatedAt}
      )
      on conflict (id) do nothing
    `;
    await transaction`
      insert into survey_responses (
        id,
        kol_id,
        status,
        submitted_at,
        confirmed_intent_only,
        confirmed_compliance,
        confirmed_final_communication,
        created_at,
        updated_at
      ) values (
        ${bundle.response.id},
        ${bundle.response.kolId},
        ${bundle.response.status},
        ${bundle.response.submittedAt},
        ${bundle.response.confirmedIntentOnly},
        ${bundle.response.confirmedCompliance},
        ${bundle.response.confirmedFinalCommunication},
        ${bundle.response.createdAt},
        ${bundle.response.updatedAt}
      )
      on conflict (id) do nothing
    `;
    for (const item of bundle.items) {
      await transaction`
        insert into survey_response_items (
          id,
          response_id,
          product_id,
          interest_level,
          rank_type,
          personal_reason,
          content_formats,
          remark,
          created_at,
          updated_at
        ) values (
          ${item.id},
          ${item.responseId},
          ${item.productId},
          ${item.interestLevel},
          ${item.rankType},
          ${item.personalReason},
          ${JSON.stringify(item.contentFormats)}::jsonb,
          ${item.remark},
          ${item.createdAt},
          ${item.updatedAt}
        )
        on conflict (id) do nothing
      `;
    }
  });
}

async function migrateFileBundlesToPostgresIfNeeded(sql: postgres.Sql) {
  if (!surveyFileMigrationPromise) {
    surveyFileMigrationPromise = (async () => {
      const [{ count }] = await sql<[{ count: string }]>`
        select count(*)::text as count from survey_responses
      `;
      if (Number(count) > 0) return;

      const fileBundles = await readJsonFile<SurveyResponseBundle[]>(RESPONSES_FILE, []);
      for (const bundle of fileBundles.reverse()) {
        await insertSurveyBundle(sql, bundle);
      }
    })();
  }

  await surveyFileMigrationPromise;
}

export async function getProducts() {
  const products = await readJsonFile<Product[]>(PRODUCTS_FILE, []);
  return products.filter((product) => product.isActive !== false);
}

export async function getProduct(productId: string) {
  const products = await getProducts();
  return products.find((product) => product.id === productId) ?? null;
}

export async function saveProducts(products: Product[]) {
  await writeJsonFile(PRODUCTS_FILE, products);
}

export async function getSurveyResponseBundles() {
  if (isFeishuConfigured()) {
    return getFeishuSurveyBundles();
  }

  const sql = await ensureSurveyTables();
  if (sql) {
    await migrateFileBundlesToPostgresIfNeeded(sql);
    const [kolRows, responseRows, itemRows] = await Promise.all([
      sql<Array<{
        id: string;
        name: string;
        platforms: unknown;
        follower_range: string;
        content_directions: unknown;
        created_at: Date;
        updated_at: Date;
      }>>`
        select
          id,
          name,
          platforms,
          follower_range,
          content_directions,
          created_at,
          updated_at
        from survey_kols
      `,
      sql<Array<{
        id: string;
        kol_id: string;
        status: "submitted";
        submitted_at: Date;
        confirmed_intent_only: boolean;
        confirmed_compliance: boolean;
        confirmed_final_communication: boolean;
        created_at: Date;
        updated_at: Date;
      }>>`
        select
          id,
          kol_id,
          status,
          submitted_at,
          confirmed_intent_only,
          confirmed_compliance,
          confirmed_final_communication,
          created_at,
          updated_at
        from survey_responses
        order by submitted_at desc
      `,
      sql<Array<{
        id: string;
        response_id: string;
        product_id: string;
        interest_level: SurveyResponseItem["interestLevel"];
        rank_type: SurveyResponseItem["rankType"];
        personal_reason: string;
        content_formats: unknown;
        remark: string;
        created_at: Date;
        updated_at: Date;
      }>>`
        select
          id,
          response_id,
          product_id,
          interest_level,
          rank_type,
          personal_reason,
          content_formats,
          remark,
          created_at,
          updated_at
        from survey_response_items
      `,
    ]);

    const kols = new Map<string, KOL>(
      kolRows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          platforms: normalizeStringArray(row.platforms),
          followerRange: row.follower_range,
          contentDirections: normalizeStringArray(row.content_directions),
          createdAt: toIsoString(row.created_at),
          updatedAt: toIsoString(row.updated_at),
        },
      ]),
    );

    const itemsByResponse = new Map<string, SurveyResponseItem[]>();
    for (const row of itemRows) {
      const item: SurveyResponseItem = {
        id: row.id,
        responseId: row.response_id,
        productId: row.product_id,
        interestLevel: row.interest_level,
        rankType: row.rank_type,
        personalReason: row.personal_reason,
        contentFormats: normalizeStringArray(row.content_formats) as SurveyResponseItem["contentFormats"],
        remark: row.remark,
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at),
      };
      itemsByResponse.set(row.response_id, [
        ...(itemsByResponse.get(row.response_id) ?? []),
        item,
      ]);
    }

    return responseRows
      .map((row) => {
        const response: SurveyResponse = {
          id: row.id,
          kolId: row.kol_id,
          status: "submitted",
          submittedAt: toIsoString(row.submitted_at),
          confirmedIntentOnly: row.confirmed_intent_only,
          confirmedCompliance: row.confirmed_compliance,
          confirmedFinalCommunication: row.confirmed_final_communication,
          createdAt: toIsoString(row.created_at),
          updatedAt: toIsoString(row.updated_at),
        };
        const kol = kols.get(row.kol_id);
        if (!kol) return null;
        return {
          kol,
          response,
          items: itemsByResponse.get(row.id) ?? [],
        };
      })
      .filter((bundle): bundle is SurveyResponseBundle => Boolean(bundle));
  }

  const bundles = await readJsonFile<SurveyResponseBundle[]>(RESPONSES_FILE, []);
  return bundles.sort((a, b) => b.response.submittedAt.localeCompare(a.response.submittedAt));
}

export async function getSurveyBundleByKolId(kolId: string) {
  const bundles = await getSurveyResponseBundles();
  return bundles.find((bundle) => bundle.kol.id === kolId) ?? null;
}

export function validateSurveySubmitPayload(payload: SurveySubmitPayload) {
  const errors: string[] = [];
  if (!payload.kol?.name?.trim()) errors.push("达人昵称 / 账号名称必填");
  if (!payload.kol?.platforms?.length) errors.push("主要平台至少选择 1 个");
  if (!payload.kol?.followerRange) errors.push("粉丝量区间必填");
  if (!payload.kol?.contentDirections?.length) errors.push("擅长内容方向至少选择 1 个");
  if (payload.items.length < 3) errors.push("请至少选择 3 个你相对看好的产品");
  if (payload.items.length > 10) errors.push("最多选择 10 个产品");
  for (const item of payload.items) {
    if (!item.interestLevel) errors.push("所有已选产品必须选择意向等级");
    if (!item.rankType) errors.push("所有已选产品必须选择意向排序");
    if (!item.contentFormats?.length) errors.push("内容形式至少选择 1 个");
  }
  for (const rank of ["top1", "top2", "top3", "top4", "top5"]) {
    const count = payload.items.filter((item) => item.rankType === rank).length;
    if (count !== 1) errors.push("必须设置第 1 到第 5 意向，且每个 Top 排序只能选一个");
  }
  if (
    !payload.confirmations?.confirmedIntentOnly ||
    !payload.confirmations?.confirmedCompliance ||
    !payload.confirmations?.confirmedFinalCommunication
  ) {
    errors.push("三个合规确认必须全部勾选");
  }
  return Array.from(new Set(errors));
}

export async function appendSurveyResponse(payload: SurveySubmitPayload) {
  const errors = validateSurveySubmitPayload(payload);
  if (errors.length) {
    throw new Error(errors[0]);
  }

  const now = new Date().toISOString();
  const kolId = createId("kol");
  const responseId = createId("response");
  const bundle: SurveyResponseBundle = {
    kol: {
      id: kolId,
      name: payload.kol.name.trim(),
      platforms: payload.kol.platforms,
      followerRange: payload.kol.followerRange,
      contentDirections: payload.kol.contentDirections,
      createdAt: now,
      updatedAt: now,
    },
    response: {
      id: responseId,
      kolId,
      status: "submitted",
      submittedAt: now,
      confirmedIntentOnly: payload.confirmations.confirmedIntentOnly,
      confirmedCompliance: payload.confirmations.confirmedCompliance,
      confirmedFinalCommunication: payload.confirmations.confirmedFinalCommunication,
      createdAt: now,
      updatedAt: now,
    },
    items: payload.items.map((item) => ({
      id: createId("item"),
      responseId,
      productId: item.productId,
      interestLevel: item.interestLevel,
      rankType: item.rankType,
      personalReason: (item.personalReason ?? "").slice(0, 100),
      contentFormats: item.contentFormats,
      remark: item.remark ?? "",
      createdAt: now,
      updatedAt: now,
    })),
  };

  if (isFeishuConfigured()) {
    await appendFeishuSurveyBundle(bundle);
    return bundle;
  }

  const sql = await ensureSurveyTables();
  if (sql) {
    await migrateFileBundlesToPostgresIfNeeded(sql);
    await insertSurveyBundle(sql, bundle);
    return bundle;
  }

  if (SURVEY_REQUIRE_PERSISTENT_STORAGE) {
    throw new Error("请先配置飞书多维表格存储后再开放提交");
  }

  const bundles = await getSurveyResponseBundles();
  await writeJsonFile(RESPONSES_FILE, [bundle, ...bundles]);
  return bundle;
}

export function getSurveyStorageInfo() {
  if (isFeishuConfigured()) {
    return {
      mode: "feishu",
      persistent: true,
      location: "FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID",
    };
  }

  if (DATABASE_URL) {
    return { mode: "postgres", persistent: true, location: "DATABASE_URL" };
  }

  if (SURVEY_REQUIRE_PERSISTENT_STORAGE) {
    return {
      mode: "missing",
      persistent: false,
      location: "missing FEISHU_* or DATABASE_URL env vars",
    };
  }

  return {
    mode: "file",
    persistent: false,
    location: RESPONSES_FILE,
  };
}
