import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAccuracy,
  createPosterSvg,
  getComboBonus,
  getResultType,
  resolveResultProfile,
  type GameStats,
} from "../lib/heartbeat-game.ts";

function createStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    redHits: 0,
    goldHits: 0,
    greenHits: 0,
    totalClicks: 0,
    successfulHits: 0,
    ...overrides,
  };
}

test("calculateAccuracy returns 0 when user has not tapped", () => {
  assert.equal(calculateAccuracy(createStats()), 0);
});

test("calculateAccuracy uses successful hits over all taps", () => {
  assert.equal(calculateAccuracy(createStats({ successfulHits: 18, totalClicks: 20 })), 0.9);
});

test("getComboBonus uses the stronger 10-hit reward when both thresholds match", () => {
  assert.equal(getComboBonus(5), 20);
  assert.equal(getComboBonus(10), 50);
  assert.equal(getComboBonus(15), 20);
  assert.equal(getComboBonus(20), 50);
});

test("getResultType prioritizes king results for very high score or combo", () => {
  assert.equal(
    getResultType(createStats({ score: 430, maxCombo: 8 })),
    "king",
  );
  assert.equal(
    getResultType(createStats({ score: 180, maxCombo: 12 })),
    "king",
  );
});

test("getResultType identifies calm players before other archetypes", () => {
  const stats = createStats({
    score: 150,
    maxCombo: 6,
    redHits: 7,
    goldHits: 8,
    greenHits: 1,
    totalClicks: 17,
    successfulHits: 15,
  });

  assert.equal(getResultType(stats), "calm");
});

test("getResultType identifies gold, stock, fund and balance players", () => {
  assert.equal(
    getResultType(
      createStats({
        goldHits: 10,
        redHits: 5,
        greenHits: 2,
        totalClicks: 18,
        successfulHits: 15,
      }),
    ),
    "gold",
  );

  assert.equal(
    getResultType(
      createStats({
        redHits: 15,
        goldHits: 8,
        greenHits: 4,
        totalClicks: 27,
        successfulHits: 23,
      }),
    ),
    "stock",
  );

  assert.equal(
    getResultType(
      createStats({
        redHits: 9,
        goldHits: 9,
        greenHits: 1,
        totalClicks: 19,
        successfulHits: 18,
        maxCombo: 8,
      }),
    ),
    "fund",
  );

  assert.equal(
    getResultType(
      createStats({
        redHits: 6,
        goldHits: 6,
        greenHits: 3,
        totalClicks: 18,
        successfulHits: 12,
        maxCombo: 4,
      }),
    ),
    "balance",
  );
});

test("resolveResultProfile selects content from the requested result family", () => {
  const profile = resolveResultProfile(
    createStats({
      goldHits: 12,
      redHits: 6,
      greenHits: 2,
      totalClicks: 20,
      successfulHits: 18,
      maxCombo: 9,
      score: 260,
    }),
    () => 0,
  );

  assert.equal(profile.type, "gold");
  assert.equal(profile.title, "黄金守护者");
  assert.equal(profile.signature, "今天适合去黄金区发一条会发光的帖子。");
  assert.equal(profile.accuracy, 0.9);
});

test("createPosterSvg embeds visible result data in the exported poster", () => {
  const svg = createPosterSvg({
    playerName: "一位心动玩家",
    title: "520 手速王",
    score: 360,
    accuracyText: "92%",
    maxCombo: 12,
    copy: "你对金心有天然感应，别人还在犹豫，你已经稳稳接住。",
  });

  assert.match(svg, /520 心跳挑战/);
  assert.match(svg, /520 手速王/);
  assert.match(svg, /总分：360/);
  assert.match(svg, /最高连击：12/);
});
