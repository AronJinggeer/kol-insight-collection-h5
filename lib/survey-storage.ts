import { promises as fs } from "fs";
import path from "path";
import type {
  Product,
  SurveyResponseBundle,
  SurveySubmitPayload,
} from "./survey-types.ts";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PRODUCTS_FILE =
  process.env.SURVEY_PRODUCTS_FILE || path.join(DATA_DIR, "products.json");
const RESPONSES_FILE =
  process.env.SURVEY_RESPONSES_FILE ||
  path.join(DATA_DIR, "survey-responses.json");

async function ensureDataFile(filePath: string, fallback: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, fallback, "utf8");
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDataFile(filePath, JSON.stringify(fallback, null, 2));
  const content = await fs.readFile(filePath, "utf8");
  if (!content.trim()) {
    return fallback;
  }
  return JSON.parse(content) as T;
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getProducts() {
  const products = await readJsonFile<Product[]>(PRODUCTS_FILE, []);
  return products.filter((product) => product.isActive !== false);
}

export async function getProduct(productId: string) {
  const products = await getProducts();
  return products.find((product) => product.id === productId) ?? null;
}

export async function saveProducts(products: Product[]) {
  await writeJsonFile(PRODUCTS_FILE, products);
}

export async function getSurveyResponseBundles() {
  const bundles = await readJsonFile<SurveyResponseBundle[]>(RESPONSES_FILE, []);
  return bundles.sort((a, b) => b.response.submittedAt.localeCompare(a.response.submittedAt));
}

export async function getSurveyBundleByKolId(kolId: string) {
  const bundles = await getSurveyResponseBundles();
  return bundles.find((bundle) => bundle.kol.id === kolId) ?? null;
}

export function validateSurveySubmitPayload(payload: SurveySubmitPayload) {
  const errors: string[] = [];
  if (!payload.kol?.name?.trim()) errors.push("达人昵称 / 账号名称必填");
  if (!payload.kol?.platforms?.length) errors.push("主要平台至少选择 1 个");
  if (!payload.kol?.followerRange) errors.push("粉丝量区间必填");
  if (!payload.kol?.contentDirections?.length) errors.push("擅长内容方向至少选择 1 个");
  if (payload.items.length < 3) errors.push("请至少选择 3 个你相对看好的产品");
  if (payload.items.length > 10) errors.push("最多选择 10 个产品");
  for (const item of payload.items) {
    if (!item.interestLevel) errors.push("所有已选产品必须选择意向等级");
    if (!item.rankType) errors.push("所有已选产品必须选择意向排序");
    if (!item.contentFormats?.length) errors.push("内容形式至少选择 1 个");
  }
  for (const rank of ["top1", "top2", "top3", "top4", "top5"]) {
    const count = payload.items.filter((item) => item.rankType === rank).length;
    if (count !== 1) errors.push("必须设置第 1 到第 5 意向，且每个 Top 排序只能选一个");
  }
  if (
    !payload.confirmations?.confirmedIntentOnly ||
    !payload.confirmations?.confirmedCompliance ||
    !payload.confirmations?.confirmedFinalCommunication
  ) {
    errors.push("三个合规确认必须全部勾选");
  }
  return Array.from(new Set(errors));
}

export async function appendSurveyResponse(payload: SurveySubmitPayload) {
  const errors = validateSurveySubmitPayload(payload);
  if (errors.length) {
    throw new Error(errors[0]);
  }

  const now = new Date().toISOString();
  const kolId = createId("kol");
  const responseId = createId("response");
  const bundle: SurveyResponseBundle = {
    kol: {
      id: kolId,
      name: payload.kol.name.trim(),
      platforms: payload.kol.platforms,
      followerRange: payload.kol.followerRange,
      contentDirections: payload.kol.contentDirections,
      createdAt: now,
      updatedAt: now,
    },
    response: {
      id: responseId,
      kolId,
      status: "submitted",
      submittedAt: now,
      confirmedIntentOnly: payload.confirmations.confirmedIntentOnly,
      confirmedCompliance: payload.confirmations.confirmedCompliance,
      confirmedFinalCommunication: payload.confirmations.confirmedFinalCommunication,
      createdAt: now,
      updatedAt: now,
    },
    items: payload.items.map((item) => ({
      id: createId("item"),
      responseId,
      productId: item.productId,
      interestLevel: item.interestLevel,
      rankType: item.rankType,
      personalReason: (item.personalReason ?? "").slice(0, 100),
      contentFormats: item.contentFormats,
      remark: item.remark ?? "",
      createdAt: now,
      updatedAt: now,
    })),
  };

  const bundles = await getSurveyResponseBundles();
  await writeJsonFile(RESPONSES_FILE, [bundle, ...bundles]);
  return bundle;
}
