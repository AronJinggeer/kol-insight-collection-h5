import { createRequire } from "module";
import {
  buildSurveyAnalytics,
  displayProductDescription,
  formatRankType,
} from "./survey-stats.ts";
import type { Product, SurveyResponseBundle } from "./survey-types.ts";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

function formatTime(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

function joinZh(values: string[]) {
  return values.filter(Boolean).join("、");
}

function withNotice(rows: Record<string, unknown>[]) {
  return [
    { 说明: "本文件仅用于内部意向统计，不作为对外宣传材料，不构成投资建议。" },
    ...rows,
  ];
}

export function buildSurveyExportWorkbook(
  products: Product[],
  bundles: SurveyResponseBundle[],
) {
  const analytics = buildSurveyAnalytics(products, bundles);
  const productById = new Map(products.map((product) => [product.id, product]));

  const productSummaryRows = analytics.productStats.map((stat) => ({
    序号: stat.product.sourceRow,
    合作机构名称: stat.product.institution,
    赛道: stat.product.track,
    产品名称: stat.product.productName,
    产品代码: stat.product.productCode,
    产品说明: displayProductDescription(stat.product.productDescription),
    总选择人数: stat.totalSelections,
    Top1人数: stat.top1Count,
    Top2人数: stat.top2Count,
    Top3人数: stat.top3Count,
    Top4人数: stat.top4Count,
    Top5人数: stat.rankTop5Count,
    备选人数: stat.backupCount,
    Top5入选人数: stat.top5Count,
    意向总分: stat.interestScore,
    平均分: stat.averageScore,
    意向达人汇总: stat.selections
      .map(
        (selection) =>
          `${selection.kol.name}（${formatRankType(selection.item.rankType)}）`,
      )
      .join("\n"),
  }));

  const kolSummaryRows = analytics.kolSummaries.map((summary) => ({
    达人昵称: summary.kol.name,
    主要平台: joinZh(summary.kol.platforms),
    粉丝量区间: summary.kol.followerRange,
    擅长内容方向: joinZh(summary.kol.contentDirections),
    选择产品数: summary.selectedCount,
    Top1产品: summary.topProducts.top1?.productName ?? "",
    Top2产品: summary.topProducts.top2?.productName ?? "",
    Top3产品: summary.topProducts.top3?.productName ?? "",
    Top4产品: summary.topProducts.top4?.productName ?? "",
    Top5产品: summary.topProducts.top5?.productName ?? "",
    补充备注: summary.bundle.response.overallRemark,
    提交时间: formatTime(summary.bundle.response.submittedAt),
  }));

  const detailRows = bundles.flatMap((bundle) =>
    bundle.items.map((item) => {
      const product = productById.get(item.productId);
      return {
        达人昵称: bundle.kol.name,
        主要平台: joinZh(bundle.kol.platforms),
        粉丝量区间: bundle.kol.followerRange,
        擅长内容方向: joinZh(bundle.kol.contentDirections),
        合作机构名称: product?.institution ?? "",
        赛道: product?.track ?? "",
        产品名称: product?.productName ?? "",
        产品代码: product?.productCode ?? "",
        产品说明: displayProductDescription(product?.productDescription ?? ""),
        意向排序: formatRankType(item.rankType),
        补充备注: bundle.response.overallRemark,
        提交时间: formatTime(bundle.response.submittedAt),
      };
    }),
  );

  const matrixRows = products.map((product) => {
    const row: Record<string, unknown> = {
      序号: product.sourceRow,
      合作机构名称: product.institution,
      赛道: product.track,
      产品名称: product.productName,
      产品代码: product.productCode,
      产品说明: displayProductDescription(product.productDescription),
    };
    for (const bundle of bundles) {
      const item = bundle.items.find((candidate) => candidate.productId === product.id);
      row[bundle.kol.name] = item ? formatRankType(item.rankType) : "";
    }
    return row;
  });

  const institutionRows = analytics.institutionRows.map((row) => ({
    合作机构名称: row.name,
    产品总数: row.productTotal,
    被选择产品数: row.selectedProductCount,
    未被选择产品数: row.unselectedProductCount,
    总选择次数: row.totalSelections,
    Top5入选次数: row.top5Count,
    意向总分: row.interestScore,
    平均分: row.averageScore,
    热度最高产品: row.hottestProduct,
    Top1产品数量: row.top1ProductCount,
  }));

  const trackRows = analytics.trackRows.map((row) => ({
    赛道: row.name,
    产品总数: row.productTotal,
    被选择产品数: row.selectedProductCount,
    未被选择产品数: row.unselectedProductCount,
    总选择次数: row.totalSelections,
    Top5入选次数: row.top5Count,
    意向总分: row.interestScore,
    平均分: row.averageScore,
    热度最高产品: row.hottestProduct,
    Top1产品数量: row.top1ProductCount,
  }));

  const workbook = XLSX.utils.book_new();
  const sheets = [
    ["产品汇总", productSummaryRows],
    ["达人汇总", kolSummaryRows],
    ["选择明细", detailRows],
    ["产品 x 达人矩阵", matrixRows],
    ["机构统计", institutionRows],
    ["赛道统计", trackRows],
  ] as const;

  for (const [name, rows] of sheets) {
    const sheet = XLSX.utils.json_to_sheet(withNotice(rows));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  return workbook;
}

export function createSurveyExportBuffer(
  products: Product[],
  bundles: SurveyResponseBundle[],
) {
  return XLSX.write(buildSurveyExportWorkbook(products, bundles), {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export function createSurveyExportFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `5-6月行情调研_导出数据_${year}${month}${day}_${hour}${minute}.xlsx`;
}
