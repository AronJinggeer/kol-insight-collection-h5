import test from "node:test";
import assert from "node:assert/strict";

import {
  getAvailableRankTypes,
  getRequiredRankTypes,
  surveySelectionLimits,
} from "../lib/survey-options.ts";

test("survey selection minimum allows one product", () => {
  assert.equal(surveySelectionLimits.min, 1);
  assert.equal(surveySelectionLimits.max, 8);
});

test("survey ranking requires ranks matching the selected product count", () => {
  assert.deepEqual(getRequiredRankTypes(1), ["top1"]);
  assert.deepEqual(getRequiredRankTypes(3), ["top1", "top2", "top3"]);
  assert.deepEqual(
    getRequiredRankTypes(6),
    ["top1", "top2", "top3", "top4", "top5"],
  );
});

test("survey ranking only shows backup when more than five products are selected", () => {
  assert.deepEqual(getAvailableRankTypes(1), ["top1"]);
  assert.deepEqual(getAvailableRankTypes(5), ["top1", "top2", "top3", "top4", "top5"]);
  assert.deepEqual(
    getAvailableRankTypes(8),
    ["top1", "top2", "top3", "top4", "top5", "backup"],
  );
});
