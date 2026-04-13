import { promises as fs } from "fs";
import path from "path";
import { productFieldKeys, SubmissionPayload } from "@/lib/form-config";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE =
  process.env.DATA_FILE_PATH || path.join(DATA_DIR, "submissions.json");

export type SubmissionRecord = SubmissionPayload & {
  id: string;
  submit_time: string;
  expertise_text: string;
  tracks_text: string;
  fund_companies_text: string;
  product_names_text: string;
  reasons_text: string;
};

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

export async function getSubmissions(): Promise<SubmissionRecord[]> {
  await ensureStorage();
  const content = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(content) as SubmissionRecord[];
}

export async function appendSubmission(payload: SubmissionPayload) {
  const records = await getSubmissions();

  const record: SubmissionRecord = {
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

  records.unshift(record);
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2), "utf-8");

  return record;
}
