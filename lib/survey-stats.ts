import {
  contentFormatLabels,
  interestLevelLabels,
  interestLevelScore,
  rankTypeLabels,
  rankTypeScore,
  topRankTypes,
} from "./survey-options.ts";
import type {
  ContentFormat,
  InterestLevel,
  KOL,
  Product,
  RankType,
  SurveyResponseBundle,
  SurveyResponseItem,
} from "./survey-types.ts";

export type ProductStat = {
  product: Product;
  selections: Array<{
    kol: KOL;
    item: SurveyResponseItem;
    submittedAt: string;
    overallRemark: string;
  }>;
  totalSelections: number;
  strongCount: number;
  mediumCount: number;
  weakCount: number;
  needMoreInfoCount: number;
  top1Count: number;
  top2Count: number;
  top3Count: number;
  top4Count: number;
  rankTop5Count: number;
  backupCount: number;
  top5Count: number;
  interestScore: number;
  averageScore: number;
};

export type KolSummary = {
  kol: KOL;
  bundle: SurveyResponseBundle;
  selectedCount: number;
  strongCount: number;
  mediumCount: number;
  weakCount: number;
  needMoreInfoCount: number;
  topProducts: Partial<Record<RankType, Product>>;
};

export function formatInterestLevel(value: InterestLevel) {
  return interestLevelLabels[value];
}

export function formatRankType(value: RankType) {
  return rankTypeLabels[value];
}

export function formatContentFormats(values: ContentFormat[]) {
  return values.map((value) => contentFormatLabels[value]).join(" / ");
}

export function displayProductDescription(value: string) {
  return value.trim() || "暂无产品说明";
}

export function scoreSurveyItem(item: SurveyResponseItem) {
  return interestLevelScore[item.interestLevel] + rankTypeScore[item.rankType];
}

function countBy<T extends string>(items: SurveyResponseItem[], key: T) {
  return items.filter((item) => item.interestLevel === key || item.rankType === key).length;
}

function sortByCountThenName<T extends { name: string; count: number; score?: number }>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      b.count - a.count ||
      (b.score ?? 0) - (a.score ?? 0) ||
      a.name.localeCompare(b.name, "zh-CN"),
  );
}

export function buildSurveyAnalytics(
  products: Product[],
  bundles: SurveyResponseBundle[],
) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const submittedBundles = bundles.filter(
    (bundle) => bundle.response.status === "submitted",
  );

  const productStats: ProductStat[] = products.map((product) => {
    const selections = submittedBundles.flatMap((bundle) =>
      bundle.items
        .filter((item) => item.productId === product.id)
        .map((item) => ({
          kol: bundle.kol,
          item,
          submittedAt: bundle.response.submittedAt,
          overallRemark: bundle.response.overallRemark,
        })),
    );
    const items = selections.map((selection) => selection.item);
    const interestScore = items.reduce((sum, item) => sum + scoreSurveyItem(item), 0);
    const totalSelections = items.length;

    return {
      product,
      selections,
      totalSelections,
      strongCount: countBy(items, "strong"),
      mediumCount: countBy(items, "medium"),
      weakCount: countBy(items, "weak"),
      needMoreInfoCount: countBy(items, "need_more_info"),
      top1Count: countBy(items, "top1"),
      top2Count: countBy(items, "top2"),
      top3Count: countBy(items, "top3"),
      top4Count: countBy(items, "top4"),
      rankTop5Count: countBy(items, "top5"),
      backupCount: countBy(items, "backup"),
      top5Count: items.filter((item) => topRankTypes.includes(item.rankType)).length,
      interestScore,
      averageScore: totalSelections ? Math.round((interestScore / totalSelections) * 10) / 10 : 0,
    };
  });

  const kolSummaries: KolSummary[] = submittedBundles.map((bundle) => {
    const topProducts: Partial<Record<RankType, Product>> = {};
    for (const item of bundle.items) {
      const product = productById.get(item.productId);
      if (product) {
        topProducts[item.rankType] = product;
      }
    }

    return {
      kol: bundle.kol,
      bundle,
      selectedCount: bundle.items.length,
      strongCount: countBy(bundle.items, "strong"),
      mediumCount: countBy(bundle.items, "medium"),
      weakCount: countBy(bundle.items, "weak"),
      needMoreInfoCount: countBy(bundle.items, "need_more_info"),
      topProducts,
    };
  });

  const selectedProductCount = productStats.filter((item) => item.totalSelections > 0).length;
  const totalSelectionCount = submittedBundles.reduce(
    (sum, bundle) => sum + bundle.items.length,
    0,
  );
  const strongSelectionCount = productStats.reduce(
    (sum, item) => sum + item.strongCount,
    0,
  );
  const top5CoveredProductCount = productStats.filter((item) =>
    topRankTypes.some((rank) => item.selections.some((selection) => selection.item.rankType === rank)),
  ).length;

  const dashboard = {
    submittedKolCount: submittedBundles.length,
    totalSelectionCount,
    selectedProductCount,
    unselectedProductCount: products.length - selectedProductCount,
    strongSelectionCount,
    top5CoveredProductCount,
    averageSelectionsPerKol: submittedBundles.length
      ? Math.round((totalSelectionCount / submittedBundles.length) * 10) / 10
      : 0,
  };

  const institutionRows = aggregateBy(products, productStats, "institution");
  const trackRows = aggregateBy(products, productStats, "track");

  return {
    dashboard,
    productStats,
    kolSummaries,
    institutionRows,
    trackRows,
    rankings: {
      productHot: [...productStats]
        .sort((a, b) => b.totalSelections - a.totalSelections || a.product.sourceRow - b.product.sourceRow)
        .slice(0, 20),
      institutionHot: sortByCountThenName(
        institutionRows.map((row) => ({ name: row.name, count: row.totalSelections, score: row.interestScore })),
      ).slice(0, 20),
      trackHot: sortByCountThenName(
        trackRows.map((row) => ({ name: row.name, count: row.totalSelections, score: row.interestScore })),
      ).slice(0, 20),
      strongProducts: [...productStats]
        .sort((a, b) => b.strongCount - a.strongCount || b.interestScore - a.interestScore)
        .slice(0, 20),
      top5Products: [...productStats]
        .sort((a, b) => b.top5Count - a.top5Count || b.interestScore - a.interestScore)
        .slice(0, 20),
    },
  };
}

function aggregateBy(
  products: Product[],
  productStats: ProductStat[],
  key: "institution" | "track",
) {
  const groups = new Map<string, ProductStat[]>();
  for (const stat of productStats) {
    const name = stat.product[key].trim();
    if (!name) continue;
    groups.set(name, [...(groups.get(name) ?? []), stat]);
  }

  return Array.from(groups.entries()).map(([name, stats]) => {
    const productTotal = products.filter((product) => product[key].trim() === name).length;
    const selectedProductCount = stats.filter((stat) => stat.totalSelections > 0).length;
    const totalSelections = stats.reduce((sum, stat) => sum + stat.totalSelections, 0);
    const interestScore = stats.reduce((sum, stat) => sum + stat.interestScore, 0);
    const hottest = [...stats].sort(
      (a, b) => b.totalSelections - a.totalSelections || b.interestScore - a.interestScore,
    )[0]?.product.productName ?? "";

    return {
      name,
      productTotal,
      selectedProductCount,
      unselectedProductCount: productTotal - selectedProductCount,
      totalSelections,
      strongCount: stats.reduce((sum, stat) => sum + stat.strongCount, 0),
      top5Count: stats.reduce((sum, stat) => sum + stat.top5Count, 0),
      interestScore,
      averageScore: totalSelections ? Math.round((interestScore / totalSelections) * 10) / 10 : 0,
      hottestProduct: hottest,
      top1ProductCount: stats.filter((stat) => stat.top1Count > 0).length,
    };
  });
}
