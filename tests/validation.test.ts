import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { maxSelectionMap } from "../lib/form-config.ts";

const projectRoot = path.resolve(import.meta.dirname, "..");
const validationSource = readFileSync(
  path.join(projectRoot, "lib/validation.ts"),
  "utf8",
);
const formPageSource = readFileSync(
  path.join(projectRoot, "components/form-page.tsx"),
  "utf8",
);

test("selection limits are updated in shared config", () => {
  assert.equal(maxSelectionMap.tracks, 5);
  assert.equal(maxSelectionMap.fund_companies, 6);
});

test("validation messages use the updated limits", () => {
  assert.match(validationSource, /最多选择 \$\{maxSelectionMap\.tracks\} 个赛道/);
  assert.match(
    validationSource,
    /最多选择 \$\{maxSelectionMap\.fund_companies\} 家基金公司/,
  );
});

test("form page no longer shows stale 3-item limit copy", () => {
  assert.doesNotMatch(formPageSource, /最看好的 3 个赛道/);
  assert.doesNotMatch(formPageSource, /最多选择 3 项/);
  assert.doesNotMatch(formPageSource, /最多选择 3 家/);
});
