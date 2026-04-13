import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";
import { productFieldKeys, SubmissionPayload } from "@/lib/form-config";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE =
  process.env.DATA_FILE_PATH || path.join(DATA_DIR, "submissions.json");
const DATABASE_URL = process.env.DATABASE_URL;

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
  mode: "file" | "postgres";
  label: string;
  location: string;
  persistent: boolean;
};

let sqlClient: postgres.Sql | null = null;
let tableReadyPromise: Promise<void> | null = null;

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

export function getStorageInfo(): StorageInfo {
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
  if (DATABASE_URL) {
    return getPostgresSubmissions();
  }

  return getFileSubmissions();
}

export async function appendSubmission(payload: SubmissionPayload) {
  if (DATABASE_URL) {
    return appendPostgresSubmission(payload);
  }

  return appendFileSubmission(payload);
}
