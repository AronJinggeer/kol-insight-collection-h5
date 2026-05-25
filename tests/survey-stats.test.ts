import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSurveyAnalytics,
  formatContentFormats,
  formatInterestLevel,
  formatRankType,
} from "../lib/survey-stats.ts";
import type {
  Product,
  SurveyResponseBundle,
} from "../lib/survey-types.ts";

const products: Product[] = [
  {
    id: "p1",
    sourceRow: 2,
    institution: "天弘",
    track: "通信设备",
    productName: "天弘中证全指通信设备指数发起C",
    productCode: "020900",
    productDescription: "",
    isActive: true,
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
  },
  {
    id: "p2",
    sourceRow: 3,
    institution: "广发",
    track: "黄金",
    productName: "广发上海金ETF联接C",
    productCode: "008987",
    productDescription: "黄金方向产品说明",
    isActive: true,
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
  },
];

const bundles: SurveyResponseBundle[] = [
  {
    kol: {
      id: "k1",
      name: "达人A",
      platforms: ["小红书"],
      followerRange: "10万-30万",
      contentDirections: ["黄金", "ETF"],
      createdAt: "2026-05-25T01:00:00.000Z",
      updatedAt: "2026-05-25T01:00:00.000Z",
    },
    response: {
      id: "r1",
      kolId: "k1",
      status: "submitted",
      submittedAt: "2026-05-25T01:05:00.000Z",
      overallRemark: "",
      confirmedIntentOnly: true,
      confirmedCompliance: true,
      confirmedFinalCommunication: true,
      createdAt: "2026-05-25T01:05:00.000Z",
      updatedAt: "2026-05-25T01:05:00.000Z",
    },
    items: [
      {
        id: "i1",
        responseId: "r1",
        productId: "p1",
        interestLevel: "strong",
        rankType: "top1",
        personalReason: "适合科普",
        contentFormats: ["xiaohongshu_note"],
        remark: "",
        createdAt: "2026-05-25T01:05:00.000Z",
        updatedAt: "2026-05-25T01:05:00.000Z",
      },
      {
        id: "i2",
        responseId: "r1",
        productId: "p2",
        interestLevel: "need_more_info",
        rankType: "backup",
        personalReason: "",
        contentFormats: ["community_post", "private_domain"],
        remark: "",
        createdAt: "2026-05-25T01:05:00.000Z",
        updatedAt: "2026-05-25T01:05:00.000Z",
      },
    ],
  },
];

test("survey analytics scores product interest with level and rank bonuses", () => {
  const analytics = buildSurveyAnalytics(products, bundles);
  const first = analytics.productStats.find((item) => item.product.id === "p1");
  const second = analytics.productStats.find((item) => item.product.id === "p2");

  assert.equal(first?.totalSelections, 1);
  assert.equal(first?.strongCount, 1);
  assert.equal(first?.top1Count, 1);
  assert.equal(first?.top5Count, 1);
  assert.equal(first?.interestScore, 150);
  assert.equal(first?.averageScore, 150);

  assert.equal(second?.needMoreInfoCount, 1);
  assert.equal(second?.backupCount, 1);
  assert.equal(second?.interestScore, 30);
  assert.equal(second?.averageScore, 30);
});

test("survey analytics builds dashboard counts and kol summaries", () => {
  const analytics = buildSurveyAnalytics(products, bundles);

  assert.equal(analytics.dashboard.submittedKolCount, 1);
  assert.equal(analytics.dashboard.totalSelectionCount, 2);
  assert.equal(analytics.dashboard.selectedProductCount, 2);
  assert.equal(analytics.dashboard.unselectedProductCount, 0);
  assert.equal(analytics.dashboard.strongSelectionCount, 1);
  assert.equal(analytics.dashboard.top5CoveredProductCount, 1);
  assert.equal(analytics.dashboard.averageSelectionsPerKol, 2);
  assert.equal(analytics.kolSummaries[0]?.topProducts.top1?.productName, products[0].productName);
});

test("survey labels preserve compliance-facing Chinese copy", () => {
  assert.equal(formatInterestLevel("strong"), "强意向，愿意重点了解");
  assert.equal(formatRankType("top1"), "第1意向");
  assert.equal(
    formatContentFormats(["xiaohongshu_note", "private_domain"]),
    "小红书笔记 / 朋友圈 / 私域",
  );
});
