import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const storageSource = readFileSync(
  path.join(projectRoot, "lib/storage.ts"),
  "utf8",
);
const appendSection = storageSource.slice(
  storageSource.indexOf("async function appendFeishuSubmission"),
  storageSource.indexOf("export function getStorageInfo"),
);
const appendSubmissionSection = storageSource.slice(
  storageSource.indexOf("export async function appendSubmission"),
);

test("Feishu writes use the base v3 batch_create endpoint", () => {
  assert.match(
    appendSection,
    /buildFeishuBatchCreateRequest\(\s*FEISHU_BITABLE_APP_TOKEN,\s*FEISHU_BITABLE_TABLE_ID,\s*record,\s*\)/,
  );
  assert.doesNotMatch(
    appendSection,
    /\/open-apis\/bitable\/v1\/apps\/.*\/records/,
  );
});

test("Feishu writes serialize records as matrix rows for batch_create", () => {
  assert.match(storageSource, /fields:\s*\[/);
  assert.match(storageSource, /rows:\s*\[/);
  assert.match(storageSource, /JSON\.stringify\(record\)/);
});

test("Feishu write failures are surfaced instead of silently falling back to file storage", () => {
  const feishuCatchSection = appendSubmissionSection.slice(
    appendSubmissionSection.indexOf("if (isFeishuConfigured())"),
    appendSubmissionSection.indexOf("if (DATABASE_URL)"),
  );

  assert.match(feishuCatchSection, /console\.error\("feishu write failed", error\)/);
  assert.match(feishuCatchSection, /throw error;/);
  assert.doesNotMatch(
    feishuCatchSection,
    /feishu write failed, falling back to file storage/,
  );
  assert.doesNotMatch(
    feishuCatchSection,
    /return appendFileSubmission\(payload\);/,
  );
});
