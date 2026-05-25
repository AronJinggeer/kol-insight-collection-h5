import path from "path";
import { createRequire } from "module";
import { saveProducts } from "../lib/survey-storage.ts";
import type { Product } from "../lib/survey-types.ts";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

const workbookPath = path.join(process.cwd(), "data", "KA机构推品.xlsx");
const sheetName = "5-6月";

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellText: false, cellDates: false });
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`找不到 Sheet：${sheetName}`);
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  let lastInstitution = "";
  const now = new Date().toISOString();
  const products: Product[] = [];

  rows.forEach((row, index) => {
    const productName = text(row["产品名称"]);
    if (!productName) return;

    const institution = text(row["合作机构名称"]) || lastInstitution || "未填写";
    lastInstitution = institution;

    const sourceRow = index + 2;
    const productCode = text(row["产品代码"]);
    const id = `product_${sourceRow}_${slug(productCode || productName)}`;

    products.push({
      id,
      sourceRow,
      institution,
      track: text(row["赛道"]),
      productName,
      productCode,
      productDescription: text(row["推荐理由（50字以内）"]),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  await saveProducts(products);
  console.log(`Imported ${products.length} products from ${workbookPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
