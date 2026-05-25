"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  contentDirectionOptions,
  followerRangeOptions,
  institutionFilterOptions,
  platformOptions,
  rankTypeLabels,
  surveySelectionLimits,
} from "@/lib/survey-options";
import {
  displayProductDescription,
  formatRankType,
} from "@/lib/survey-stats";
import type {
  Product,
  RankType,
  SurveySubmitPayload,
} from "@/lib/survey-types";

type SurveyStep = "info" | "products" | "review" | "success";

type DraftItem = {
  productId: string;
  rankType: RankType;
};

type Draft = {
  kol: SurveySubmitPayload["kol"];
  items: DraftItem[];
  confirmations: SurveySubmitPayload["confirmations"];
  overallRemark: string;
  submittedKolId: string;
};

const emptyDraft: Draft = {
  kol: {
    name: "",
    platforms: [],
    followerRange: "",
    contentDirections: [],
  },
  items: [],
  confirmations: {
    confirmedIntentOnly: false,
    confirmedCompliance: false,
    confirmedFinalCommunication: false,
  },
  overallRemark: "",
  submittedKolId: "",
};

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function Pill({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 max-w-full rounded-full border px-4 text-sm leading-5 transition ${
        selected
          ? "border-[#B88700] bg-[#F6D77A] text-[#1F2937]"
          : "border-[#E9DDB8] bg-white text-[#445166] hover:border-[#B88700]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {label}
    </button>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-lg border border-[#E9DDB8] bg-white px-3 text-sm text-[#1F2937]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function displayProductTrack(track: string) {
  const value = track.trim();
  if (!value || value === "未填写" || value === "其他") return "";
  return value;
}

function formatProductMeta(product: Product) {
  return [product.institution, displayProductTrack(product.track), product.productCode]
    .filter(Boolean)
    .join(" / ");
}

function BaseLayout({
  children,
  title = "5-6月行情调研",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <main className="min-h-screen bg-[#FFFDF5] px-3 py-4 text-[#1F2937] sm:px-6 sm:py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-lg border border-[#F0DFAD] bg-[#FFF7D6] p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B88700]">
            MARKET PULSE
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[#1F2937] sm:text-3xl">
            {title}
          </h1>
        </header>
        {children}
      </div>
    </main>
  );
}

export function SurveyShell({ step }: { step: SurveyStep }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("survey-5-6-draft");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Draft>;
      setDraft({
        ...emptyDraft,
        ...parsed,
        kol: { ...emptyDraft.kol, ...parsed.kol },
        confirmations: {
          ...emptyDraft.confirmations,
          ...parsed.confirmations,
        },
        items: (parsed.items ?? []).map((item) => ({
          productId: item.productId,
          rankType: item.rankType ?? "backup",
        })),
        overallRemark: parsed.overallRemark ?? "",
        submittedKolId: parsed.submittedKolId ?? "",
      });
    }
    setDraftReady(true);
    fetch("/api/survey/products")
      .then((response) => response.json())
      .then((data) => setProducts(data.products ?? []));
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    window.localStorage.setItem("survey-5-6-draft", JSON.stringify(draft));
  }, [draft, draftReady]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  function go(path: string) {
    setMessage("");
    router.push(path);
  }

  if (step === "products") {
    return (
      <ProductsStep
        draft={draft}
        products={products}
        message={message}
        setDraft={setDraft}
        setMessage={setMessage}
        go={go}
      />
    );
  }

  if (step === "review") {
    return (
      <ReviewStep
        draft={draft}
        products={products}
        productById={productById}
        message={message}
        setDraft={setDraft}
        setMessage={setMessage}
        go={go}
      />
    );
  }

  if (step === "success") {
    return (
      <SuccessStep
        draft={draft}
        productById={productById}
        go={go}
      />
    );
  }

  return (
    <BaseLayout>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <p className="max-w-3xl text-sm leading-7 text-[#4B5563]">
          我们整理了一批近期机构重点推荐的产品方向，想邀请你根据自己的内容风格、受众偏好和近期选题节奏，选择你相对看好的产品。
        </p>
        <p className="mt-4 rounded-lg bg-[#FFF7D6] p-4 text-sm leading-7 text-[#5F4A12]">
          本次征集仅用于意向收集，不代表任何合作，也不构成任何投资建议或销售承诺。你可以按照自己的内容判断来选择，不需要站在机构角度做推荐。
        </p>
      </section>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xl font-semibold">先简单介绍一下你自己</h2>
        <div className="mt-5 space-y-6">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">达人昵称 / 账号名称 *</span>
            <input
              value={draft.kol.name}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  kol: { ...draft.kol, name: event.target.value },
                })
              }
              placeholder="请输入你的昵称或账号名称"
              className="h-12 w-full rounded-lg border border-[#E9DDB8] px-3 text-sm"
            />
          </label>
          <MultiField
            label="主要平台 *"
            options={platformOptions}
            values={draft.kol.platforms}
            onChange={(values) =>
              setDraft({ ...draft, kol: { ...draft.kol, platforms: values } })
            }
          />
          <div className="space-y-3">
            <p className="text-sm font-semibold">粉丝量区间 *</p>
            <div className="flex flex-wrap gap-2">
              {followerRangeOptions.map((option) => (
                <Pill
                  key={option}
                  label={option}
                  selected={draft.kol.followerRange === option}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      kol: { ...draft.kol, followerRange: option },
                    })
                  }
                />
              ))}
            </div>
          </div>
          <MultiField
            label="你更擅长的内容方向 *"
            options={contentDirectionOptions}
            values={draft.kol.contentDirections}
            onChange={(values) =>
              setDraft({
                ...draft,
                kol: { ...draft.kol, contentDirections: values },
              })
            }
          />
        </div>
        {message ? <p className="mt-4 text-sm text-[#B88700]">{message}</p> : null}
        <div className="mt-6 flex justify-stretch sm:justify-end">
          <button
            className="w-full rounded-lg bg-[#1F2937] px-5 py-3 text-sm font-semibold text-white sm:w-auto"
            onClick={() => {
              if (!draft.kol.name.trim()) return setMessage("达人昵称 / 账号名称必填");
              if (!draft.kol.platforms.length) return setMessage("主要平台至少选择 1 个");
              if (!draft.kol.followerRange) return setMessage("粉丝量区间必填");
              if (!draft.kol.contentDirections.length) return setMessage("擅长内容方向至少选择 1 个");
              go("/survey/products");
            }}
          >
            下一步，选择产品
          </button>
        </div>
      </section>
    </BaseLayout>
  );
}

function MultiField({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Pill
            key={option}
            label={option}
            selected={values.includes(option)}
            onClick={() => onChange(toggleValue(values, option))}
          />
        ))}
      </div>
    </div>
  );
}

function ProductsStep({
  draft,
  products,
  message,
  setDraft,
  setMessage,
  go,
}: {
  draft: Draft;
  products: Product[];
  message: string;
  setDraft: (draft: Draft) => void;
  setMessage: (message: string) => void;
  go: (path: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [institution, setInstitution] = useState("全部机构");
  const [track, setTrack] = useState("全部赛道");
  const [status, setStatus] = useState("全部产品");
  const canContinue =
    draft.items.length >= surveySelectionLimits.min &&
    draft.items.length <= surveySelectionLimits.max;
  const selectedIds = draft.items.map((item) => item.productId);
  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
  const trackOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.track.trim())
            .filter((value) => value && value !== "未填写" && value !== "其他"),
        ),
      ),
    [products],
  );
  const filteredProducts = products.filter((product) => {
    const matchedKeyword =
      !keyword ||
      [product.productName, product.productCode, product.institution, product.track]
        .join(" ")
        .toLowerCase()
        .includes(keyword.toLowerCase());
    const matchedInstitution =
      institution === "全部机构" || product.institution.includes(institution);
    const matchedTrack = track === "全部赛道" || product.track === track;
    const isSelected = selectedIds.includes(product.id);
    const matchedStatus =
      status === "全部产品" ||
      (status === "已选择" && isSelected) ||
      (status === "未选择" && !isSelected);
    return matchedKeyword && matchedInstitution && matchedTrack && matchedStatus;
  });

  function toggleProduct(productId: string) {
    const exists = draft.items.some((item) => item.productId === productId);
    if (!exists && draft.items.length >= surveySelectionLimits.max) {
      setMessage("最多选择 8 个产品，建议只保留你真正愿意进一步了解的方向。");
      return;
    }
    setDraft({
      ...draft,
      items: exists
        ? draft.items.filter((item) => item.productId !== productId)
        : [
            ...draft.items,
            {
              productId,
              rankType: "backup",
            },
          ],
    });
  }

  function continueToReview() {
    if (draft.items.length < surveySelectionLimits.min) {
      setMessage("请至少选择 3 个你相对看好的产品，方便我们做后续统计。");
      return;
    }
    if (draft.items.length > surveySelectionLimits.max) {
      setMessage("最多选择 8 个产品，建议只保留你真正愿意进一步了解的方向。");
      return;
    }
    const rankedDraft: Draft = {
      ...draft,
      items: draft.items.map((item, index) => ({
        ...item,
        rankType:
          index === 0 ? "top1" :
          index === 1 ? "top2" :
          index === 2 ? "top3" :
          index === 3 ? "top4" :
          index === 4 ? "top5" :
          "backup",
      })),
    };
    setDraft(rankedDraft);
    window.localStorage.setItem("survey-5-6-draft", JSON.stringify(rankedDraft));
    go("/survey/review");
  }

  return (
    <BaseLayout title="选择你近期更看好的产品">
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm leading-7 text-[#4B5563]">
          请从下面的产品池中，选择你认为更适合自己内容方向、粉丝受众和近期市场环境的产品。建议选择 3 到 8 个产品。如果你对某个产品感兴趣，但还需要更多资料，也可以先加入意向。
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#FFF7D6] px-4 py-3 text-sm text-[#5F4A12]">
          <span>已选择 {draft.items.length} / {surveySelectionLimits.max}</span>
          <span>至少选择 3 个产品后可进入下一步</span>
          <button
            type="button"
            disabled={!canContinue}
            onClick={continueToReview}
            className="w-full rounded-lg bg-[#1F2937] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            下一步，排序前 5 名
          </button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索产品名称、产品代码、机构或赛道"
            className="h-12 rounded-lg border border-[#E9DDB8] px-3 text-sm"
          />
          <SelectField value={institution} onChange={setInstitution} options={["全部机构", ...institutionFilterOptions]} />
          <SelectField value={track} onChange={setTrack} options={["全部赛道", ...trackOptions]} />
          <SelectField value={status} onChange={setStatus} options={["全部产品", "已选择", "未选择"]} />
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-3">
          {filteredProducts.map((product) => {
            const selected = selectedIds.includes(product.id);
            return (
              <article key={product.id} className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#FFF7D6] px-3 py-1 text-[#7A5A00]">机构：{product.institution}</span>
                  {displayProductTrack(product.track) ? (
                    <span className="rounded-full bg-[#F5F6F8] px-3 py-1 text-[#4B5563]">赛道：{displayProductTrack(product.track)}</span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-base font-semibold leading-7 sm:text-lg">{product.productName}</h3>
                <p className="mt-1 font-mono text-sm text-[#6B7280]">{product.productCode}</p>
                <p className="mt-3 text-sm leading-7 text-[#4B5563]">产品说明：{displayProductDescription(product.productDescription)}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
                  <button
                    onClick={() => toggleProduct(product.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      selected ? "bg-[#FFF7D6] text-[#8A6400]" : "bg-[#1F2937] text-white"
                    }`}
                  >
                    {selected ? "已加入" : "加入意向"}
                  </button>
                  {selected ? (
                    <button onClick={() => toggleProduct(product.id)} className="rounded-lg border border-[#E9DDB8] px-4 py-2 text-sm">
                      取消
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
        <aside className="mobile-order-first h-fit rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm lg:sticky lg:top-5 lg:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">已选产品</h2>
            <span className="rounded-full bg-[#FFF7D6] px-3 py-1 text-xs font-semibold text-[#8A6400]">
              {draft.items.length} / {surveySelectionLimits.max}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">你可以先把感兴趣的产品加入这里，下一步再确认 Top 5 意向排序。</p>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 lg:max-h-none">
            {selectedProducts.map((product) => (
              <div key={product.id} className="rounded-lg border border-[#F0DFAD] p-3">
                <p className="text-sm font-semibold">{product.productName}</p>
                <p className="mt-1 text-xs text-[#6B7280]">{formatProductMeta(product)}</p>
                <button onClick={() => toggleProduct(product.id)} className="mt-2 text-xs text-[#B88700]">移除</button>
              </div>
            ))}
          </div>
          {message ? <p className="mt-4 text-sm text-[#B88700]">{message}</p> : null}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button onClick={() => go("/survey")} className="rounded-lg border border-[#E9DDB8] px-4 py-3 text-sm">上一步</button>
            <button
              disabled={!canContinue}
              onClick={continueToReview}
              className="rounded-lg bg-[#1F2937] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一步，排序前 5 名
            </button>
          </div>
        </aside>
      </div>
    </BaseLayout>
  );
}

function ReviewStep({
  draft,
  products,
  productById,
  message,
  setDraft,
  setMessage,
  go,
}: {
  draft: Draft;
  products: Product[];
  productById: Map<string, Product>;
  message: string;
  setDraft: (draft: Draft) => void;
  setMessage: (message: string) => void;
  go: (path: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  function setRank(productId: string, rankType: RankType) {
    setDraft({
      ...draft,
      items: draft.items.map((item) => {
        if (item.productId === productId) return { ...item, rankType };
        if (rankType !== "backup" && item.rankType === rankType) {
          return { ...item, rankType: "backup" };
        }
        return item;
      }),
    });
  }

  async function submit() {
    const missingTop = ["top1", "top2", "top3", "top4", "top5"].some(
      (rank) => draft.items.filter((item) => item.rankType === rank).length !== 1,
    );
    if (missingTop) return setMessage("必须设置第 1 到第 5 意向");
    if (!draft.confirmations.confirmedIntentOnly || !draft.confirmations.confirmedCompliance || !draft.confirmations.confirmedFinalCommunication) {
      return setMessage("三个合规确认必须全部勾选");
    }
    setSubmitting(true);
    const response = await fetch("/api/survey/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const result = await response.json();
    setSubmitting(false);
    if (!response.ok) return setMessage(result.message ?? "提交失败，请稍后重试");
    setDraft({ ...draft, submittedKolId: result.kolId });
    go("/survey/success");
  }

  const selectedProducts = draft.items
    .map((item) => ({ item, product: productById.get(item.productId) }))
    .filter((entry): entry is { item: DraftItem; product: Product } => Boolean(entry.product));

  return (
    <BaseLayout title="确认你的产品意向">
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm leading-7 text-[#4B5563]">请为已选产品设置意向排序。这部分信息只用于内部意向统计。</p>
        <p className="mt-3 rounded-lg bg-[#FFF7D6] p-4 text-sm text-[#5F4A12]">请至少设置 Top 5 产品。Top 5 代表你当前最愿意优先了解或沟通的方向。</p>
      </section>
      <section className="space-y-4">
        {selectedProducts.length === 0 ? (
          <div className="rounded-lg border border-[#F0DFAD] bg-white p-4 text-sm leading-7 text-[#6B7280] shadow-sm sm:p-5">
            还没有可排序的产品，请返回上一步重新选择。
          </div>
        ) : null}
        {selectedProducts.map(({ product, item }) => (
          <article key={product.id} className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold leading-7 sm:text-lg">{product.productName}</h2>
            <p className="mt-1 text-sm text-[#6B7280]">{formatProductMeta(product)}</p>
            <p className="mt-3 text-sm leading-7 text-[#4B5563]">产品说明：{displayProductDescription(product.productDescription)}</p>
            <div className="mt-5">
              <OptionGroup
                title="意向排序 *"
                options={Object.entries(rankTypeLabels)}
                value={item.rankType}
                onChange={(value) => setRank(product.id, value as RankType)}
              />
            </div>
          </article>
        ))}
      </section>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">补充备注</span>
          <textarea
            value={draft.overallRemark}
            onChange={(event) => setDraft({ ...draft, overallRemark: event.target.value })}
            placeholder="比如希望补充哪些资料、是否需要更多市场观点、是否需要更清晰的产品信息等"
            className="min-h-24 w-full rounded-lg border border-[#E9DDB8] p-3 text-sm"
          />
        </label>
      </section>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">提交前确认</h2>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                confirmations: {
                  confirmedIntentOnly: true,
                  confirmedCompliance: true,
                  confirmedFinalCommunication: true,
                },
              })
            }
            className="rounded-full border border-[#B88700] px-4 py-2 text-sm font-semibold text-[#8A6400]"
          >
            一键全选
          </button>
        </div>
        {[
          ["confirmedIntentOnly", "我确认本次填写仅代表意向选择，不构成投资建议。"],
          ["confirmedCompliance", "我理解后续正式内容需要经过合规审核，不使用保本、稳赚、确定收益、一定上涨等不合规表达。"],
          ["confirmedFinalCommunication", "我理解最终合作产品、合作形式和排期，需要双方进一步确认。"],
        ].map(([key, label]) => (
          <label key={key} className="mt-3 flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={draft.confirmations[key as keyof Draft["confirmations"]]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  confirmations: {
                    ...draft.confirmations,
                    [key]: event.target.checked,
                  },
                })
              }
              className="mt-1"
            />
            <span>{label}</span>
          </label>
        ))}
        {message ? <p className="mt-4 text-sm text-[#B88700]">{message}</p> : null}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:flex">
          <button onClick={() => go("/survey/products")} className="rounded-lg border border-[#E9DDB8] px-5 py-3 text-sm">上一步</button>
          <button disabled={submitting} onClick={submit} className="rounded-lg bg-[#1F2937] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? "提交中..." : "提交意向"}
          </button>
        </div>
      </section>
    </BaseLayout>
  );
}

function OptionGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([key, label]) => (
          <Pill key={key} label={label} selected={value === key} onClick={() => onChange(key)} />
        ))}
      </div>
    </div>
  );
}

function SuccessStep({
  draft,
  productById,
  go,
}: {
  draft: Draft;
  productById: Map<string, Product>;
  go: (path: string) => void;
}) {
  const topItems = [...draft.items]
    .filter((item) => item.rankType !== "backup")
    .sort((a, b) => a.rankType.localeCompare(b.rankType))
    .map((item) => ({ item, product: productById.get(item.productId) }))
    .filter((entry): entry is { item: DraftItem; product: Product } => Boolean(entry.product));

  return (
    <BaseLayout title="提交成功">
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-2xl font-semibold">已收到你的产品意向。</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4B5563]">我们会根据你的选择，结合你的内容方向、平台特点和近期排期，做后续沟通。</p>
      </section>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xl font-semibold">你的 Top 5 产品</h2>
        <div className="mt-4 grid gap-3">
          {topItems.map(({ item, product }) => (
            <div key={product.id} className="rounded-lg border border-[#F0DFAD] p-4">
              <p className="text-sm text-[#B88700]">{formatRankType(item.rankType)}</p>
              <h3 className="mt-1 font-semibold">{product.productName}</h3>
              <p className="mt-1 text-sm text-[#6B7280]">{formatProductMeta(product)}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-[#6B7280]">如果后续需要修改选择，可以联系对接人调整。</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:flex">
          <button onClick={() => go("/survey/review")} className="rounded-lg border border-[#E9DDB8] px-5 py-3 text-sm">查看我的选择</button>
          <button onClick={() => window.close()} className="rounded-lg bg-[#1F2937] px-5 py-3 text-sm font-semibold text-white">关闭页面</button>
        </div>
      </section>
    </BaseLayout>
  );
}
