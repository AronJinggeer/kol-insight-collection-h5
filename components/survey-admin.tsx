"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  contentFormatLabels,
  interestLevelLabels,
  rankTypeLabels,
} from "@/lib/survey-options";
import {
  buildSurveyAnalytics,
  displayProductDescription,
  formatContentFormats,
  formatInterestLevel,
  formatRankType,
} from "@/lib/survey-stats";
import type { ContentFormat, Product, SurveyResponseBundle } from "@/lib/survey-types";

type AdminView =
  | "home"
  | "products"
  | "productDetail"
  | "kols"
  | "kolDetail"
  | "responses"
  | "export";

function joinZh(values: string[]) {
  return values.filter(Boolean).join("、");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function AdminLayout({ children }: { children: ReactNode }) {
  const links = [
    ["/admin", "首页"],
    ["/admin/products", "产品统计"],
    ["/admin/kols", "达人提交"],
    ["/admin/responses", "选择明细"],
    ["/admin/export", "数据导出"],
  ];
  return (
    <main className="min-h-screen bg-[#FFFDF5] px-3 py-4 text-[#1F2937] sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <nav className="grid grid-cols-2 gap-2 rounded-lg border border-[#F0DFAD] bg-white p-3 shadow-sm sm:flex sm:flex-wrap">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-center text-sm text-[#5B6472] hover:bg-[#FFF7D6] sm:text-left">
              {label}
            </a>
          ))}
          <a href="/api/admin/export" className="col-span-2 rounded-lg bg-[#1F2937] px-3 py-2 text-center text-sm font-semibold text-white sm:ml-auto">
            导出全部数据 Excel
          </a>
        </nav>
        {children}
      </div>
    </main>
  );
}

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function login() {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const result = await response.json();
      setMessage(result.message ?? "后台密码不正确");
      return;
    }
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFFDF5] px-4">
      <section className="w-full max-w-sm rounded-lg border border-[#F0DFAD] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">5-6月行情调研后台</h1>
        <label className="mt-6 block space-y-2">
          <span className="text-sm font-semibold">后台密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-lg border border-[#E9DDB8] px-3"
          />
        </label>
        {message ? <p className="mt-3 text-sm text-[#B88700]">{message}</p> : null}
        <button onClick={login} className="mt-5 w-full rounded-lg bg-[#1F2937] px-4 py-3 text-sm font-semibold text-white">
          进入后台
        </button>
      </section>
    </main>
  );
}

export function SurveyAdmin({
  products,
  bundles,
  view,
  productId,
  kolId,
}: {
  products: Product[];
  bundles: SurveyResponseBundle[];
  view: AdminView;
  productId?: string;
  kolId?: string;
}) {
  const analytics = useMemo(() => buildSurveyAnalytics(products, bundles), [products, bundles]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  if (view === "products") return <ProductsTable analytics={analytics} />;
  if (view === "productDetail") return <ProductDetail analytics={analytics} productId={productId ?? ""} />;
  if (view === "kols") return <KolsTable analytics={analytics} />;
  if (view === "kolDetail") return <KolDetail bundles={bundles} products={products} kolId={kolId ?? ""} />;
  if (view === "responses") return <ResponsesTable bundles={bundles} productById={productById} />;
  if (view === "export") return <ExportPage />;

  return (
    <AdminLayout>
      <header className="rounded-lg border border-[#F0DFAD] bg-[#FFF7D6] p-4 shadow-sm sm:p-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">5-6月行情调研后台</h1>
      </header>
      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["已提交达人数量", analytics.dashboard.submittedKolCount],
          ["总选择次数", analytics.dashboard.totalSelectionCount],
          ["被选择产品数量", analytics.dashboard.selectedProductCount],
          ["未被选择产品数量", analytics.dashboard.unselectedProductCount],
          ["强意向选择次数", analytics.dashboard.strongSelectionCount],
          ["Top 5 覆盖产品数量", analytics.dashboard.top5CoveredProductCount],
          ["平均每位达人选择产品数", analytics.dashboard.averageSelectionsPerKol],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm">
            <p className="text-xs text-[#6B7280]">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Ranking title="产品热度 Top 20" rows={analytics.rankings.productHot.map((stat) => [stat.product.productName, stat.totalSelections])} />
        <Ranking title="机构热度 Top 20" rows={analytics.rankings.institutionHot.map((row) => [row.name, row.count])} />
        <Ranking title="赛道热度 Top 20" rows={analytics.rankings.trackHot.map((row) => [row.name, row.count])} />
        <Ranking title="强意向产品 Top 20" rows={analytics.rankings.strongProducts.map((stat) => [stat.product.productName, stat.strongCount])} />
        <Ranking title="Top 5 入选产品 Top 20" rows={analytics.rankings.top5Products.map((stat) => [stat.product.productName, stat.top5Count])} />
      </section>
    </AdminLayout>
  );
}

function Ranking({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <section className="rounded-lg border border-[#F0DFAD] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.map(([name, count], index) => (
          <div key={`${name}-${index}`} className="flex justify-between gap-4 text-sm">
            <span className="truncate">{index + 1}. {name}</span>
            <span className="font-semibold text-[#B88700]">{count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductsTable({ analytics }: { analytics: ReturnType<typeof buildSurveyAnalytics> }) {
  const [institution, setInstitution] = useState("");
  const [track, setTrack] = useState("");
  const [selected, setSelected] = useState("");
  const [interest, setInterest] = useState("");
  const [top5, setTop5] = useState("");
  const [sort, setSort] = useState("source");
  const rows = analytics.productStats
    .filter((stat) => !institution || stat.product.institution === institution)
    .filter((stat) => !track || stat.product.track === track)
    .filter((stat) => !selected || (selected === "yes" ? stat.totalSelections > 0 : stat.totalSelections === 0))
    .filter((stat) => !interest || stat.selections.some((selection) => selection.item.interestLevel === interest))
    .filter((stat) => !top5 || (top5 === "yes" ? stat.top5Count > 0 : stat.top5Count === 0))
    .sort((a, b) => {
      if (sort === "total") return b.totalSelections - a.totalSelections;
      if (sort === "strong") return b.strongCount - a.strongCount;
      if (sort === "top5") return b.top5Count - a.top5Count;
      if (sort === "score") return b.interestScore - a.interestScore;
      if (sort === "avg") return b.averageScore - a.averageScore;
      return a.product.sourceRow - b.product.sourceRow;
    });
  const institutions = Array.from(new Set(analytics.productStats.map((row) => row.product.institution)));
  const tracks = Array.from(new Set(analytics.productStats.map((row) => row.product.track)));

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold sm:text-3xl">产品统计</h1>
      <FilterBar>
        <Select value={institution} onChange={setInstitution} options={["", ...institutions]} empty="全部机构" />
        <Select value={track} onChange={setTrack} options={["", ...tracks]} empty="全部赛道" />
        <Select value={selected} onChange={setSelected} options={["", "yes", "no"]} labels={{ yes: "已被选择", no: "未被选择" }} empty="是否被选择" />
        <Select value={interest} onChange={setInterest} options={["", ...Object.keys(interestLevelLabels)]} labels={interestLevelLabels} empty="意向等级" />
        <Select value={top5} onChange={setTop5} options={["", "yes", "no"]} labels={{ yes: "进入 Top 5", no: "未进 Top 5" }} empty="是否进入 Top 5" />
        <Select value={sort} onChange={setSort} options={["source", "total", "strong", "top5", "score", "avg"]} labels={{ source: "按原 Excel 序号排序", total: "按总选择人数排序", strong: "按强意向人数排序", top5: "按 Top5 入选人数排序", score: "按意向总分排序", avg: "按平均分排序" }} empty="" />
      </FilterBar>
      <Table headers={["序号", "机构", "赛道", "产品名称", "产品代码", "产品说明", "总选择人数", "强", "中", "弱", "需资料", "Top1", "Top2", "Top3", "Top4", "Top5", "备选", "意向总分", "平均分"]}>
        {rows.map((stat) => (
          <tr key={stat.product.id}>
            <td>{stat.product.sourceRow}</td><td>{stat.product.institution}</td><td>{stat.product.track}</td>
            <td><a className="text-[#B88700]" href={`/admin/products/${stat.product.id}`}>{stat.product.productName}</a></td>
            <td className="font-mono">{stat.product.productCode}</td><td>{displayProductDescription(stat.product.productDescription)}</td>
            <td>{stat.totalSelections}</td><td>{stat.strongCount}</td><td>{stat.mediumCount}</td><td>{stat.weakCount}</td><td>{stat.needMoreInfoCount}</td>
            <td>{stat.top1Count}</td><td>{stat.top2Count}</td><td>{stat.top3Count}</td><td>{stat.top4Count}</td><td>{stat.rankTop5Count}</td><td>{stat.backupCount}</td><td>{stat.interestScore}</td><td>{stat.averageScore}</td>
          </tr>
        ))}
      </Table>
    </AdminLayout>
  );
}

function ProductDetail({ analytics, productId }: { analytics: ReturnType<typeof buildSurveyAnalytics>; productId: string }) {
  const stat = analytics.productStats.find((item) => item.product.id === productId);
  if (!stat) return <AdminLayout><p>未找到产品</p></AdminLayout>;
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold sm:text-3xl">产品详情</h1>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold leading-7 sm:text-xl">{stat.product.productName}</h2>
        <p className="mt-2 text-sm text-[#6B7280]">{stat.product.institution} / {stat.product.track} / {stat.product.productCode}</p>
        <p className="mt-3 text-sm leading-7">产品说明：{displayProductDescription(stat.product.productDescription)}</p>
        <p className="mt-2 text-sm text-[#6B7280]">原 Excel 行号：{stat.product.sourceRow}</p>
      </section>
      <Ranking title="统计区" rows={[["总选择人数", stat.totalSelections], ["强意向人数", stat.strongCount], ["中意向人数", stat.mediumCount], ["弱意向人数", stat.weakCount], ["需要更多资料人数", stat.needMoreInfoCount], ["Top1人数", stat.top1Count], ["Top2人数", stat.top2Count], ["Top3人数", stat.top3Count], ["Top4人数", stat.top4Count], ["Top5人数", stat.rankTop5Count], ["备选人数", stat.backupCount], ["意向总分", stat.interestScore], ["平均分", stat.averageScore]]} />
      <Table headers={["达人昵称", "主要平台", "粉丝量区间", "擅长内容方向", "意向等级", "意向排序", "内容形式", "感兴趣原因", "补充备注", "提交时间"]}>
        {stat.selections.map((selection) => (
          <tr key={selection.item.id}>
            <td>{selection.kol.name}</td><td>{joinZh(selection.kol.platforms)}</td><td>{selection.kol.followerRange}</td><td>{joinZh(selection.kol.contentDirections)}</td>
            <td>{formatInterestLevel(selection.item.interestLevel)}</td><td>{formatRankType(selection.item.rankType)}</td><td>{formatContentFormats(selection.item.contentFormats)}</td><td>{selection.item.personalReason}</td><td>{selection.item.remark}</td><td>{formatTime(selection.submittedAt)}</td>
          </tr>
        ))}
      </Table>
    </AdminLayout>
  );
}

function KolsTable({ analytics }: { analytics: ReturnType<typeof buildSurveyAnalytics> }) {
  const [keyword, setKeyword] = useState("");
  const [platform, setPlatform] = useState("");
  const [follower, setFollower] = useState("");
  const [direction, setDirection] = useState("");
  const rows = analytics.kolSummaries
    .filter((summary) => !keyword || summary.kol.name.includes(keyword))
    .filter((summary) => !platform || summary.kol.platforms.includes(platform))
    .filter((summary) => !follower || summary.kol.followerRange === follower)
    .filter((summary) => !direction || summary.kol.contentDirections.includes(direction));
  const platforms = Array.from(new Set(analytics.kolSummaries.flatMap((row) => row.kol.platforms)));
  const followers = Array.from(new Set(analytics.kolSummaries.map((row) => row.kol.followerRange)));
  const directions = Array.from(new Set(analytics.kolSummaries.flatMap((row) => row.kol.contentDirections)));
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold sm:text-3xl">达人提交列表</h1>
      <FilterBar>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索达人昵称" className="h-11 rounded-lg border border-[#E9DDB8] px-3 text-sm" />
        <Select value={platform} onChange={setPlatform} options={["", ...platforms]} empty="全部平台" />
        <Select value={follower} onChange={setFollower} options={["", ...followers]} empty="全部粉丝量区间" />
        <Select value={direction} onChange={setDirection} options={["", ...directions]} empty="擅长内容方向" />
      </FilterBar>
      <Table headers={["达人昵称", "主要平台", "粉丝量区间", "擅长内容方向", "选择产品数量", "Top1产品", "Top2产品", "Top3产品", "Top4产品", "Top5产品", "提交时间"]}>
        {rows.map((summary) => (
          <tr key={summary.kol.id}>
            <td><a className="text-[#B88700]" href={`/admin/kols/${summary.kol.id}`}>{summary.kol.name}</a></td><td>{joinZh(summary.kol.platforms)}</td><td>{summary.kol.followerRange}</td><td>{joinZh(summary.kol.contentDirections)}</td><td>{summary.selectedCount}</td>
            <td>{summary.topProducts.top1?.productName ?? ""}</td><td>{summary.topProducts.top2?.productName ?? ""}</td><td>{summary.topProducts.top3?.productName ?? ""}</td><td>{summary.topProducts.top4?.productName ?? ""}</td><td>{summary.topProducts.top5?.productName ?? ""}</td><td>{formatTime(summary.bundle.response.submittedAt)}</td>
          </tr>
        ))}
      </Table>
    </AdminLayout>
  );
}

function KolDetail({ bundles, products, kolId }: { bundles: SurveyResponseBundle[]; products: Product[]; kolId: string }) {
  const bundle = bundles.find((item) => item.kol.id === kolId);
  const productById = new Map(products.map((product) => [product.id, product]));
  if (!bundle) return <AdminLayout><p>未找到达人</p></AdminLayout>;
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold sm:text-3xl">达人详情</h1>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xl font-semibold">{bundle.kol.name}</h2>
        <p className="mt-2 text-sm text-[#6B7280]">{joinZh(bundle.kol.platforms)} / {bundle.kol.followerRange} / {joinZh(bundle.kol.contentDirections)}</p>
        <p className="mt-2 text-sm text-[#6B7280]">提交时间：{formatTime(bundle.response.submittedAt)}</p>
      </section>
      <Table headers={["意向排序", "机构", "赛道", "产品名称", "产品代码", "产品说明", "意向等级", "内容形式", "感兴趣原因", "补充备注"]}>
        {bundle.items.map((item) => {
          const product = productById.get(item.productId);
          return <tr key={item.id}><td>{formatRankType(item.rankType)}</td><td>{product?.institution}</td><td>{product?.track}</td><td>{product?.productName}</td><td>{product?.productCode}</td><td>{displayProductDescription(product?.productDescription ?? "")}</td><td>{formatInterestLevel(item.interestLevel)}</td><td>{formatContentFormats(item.contentFormats)}</td><td>{item.personalReason}</td><td>{item.remark}</td></tr>;
        })}
      </Table>
    </AdminLayout>
  );
}

function ResponsesTable({ bundles, productById }: { bundles: SurveyResponseBundle[]; productById: Map<string, Product> }) {
  const [keyword, setKeyword] = useState("");
  const [institution, setInstitution] = useState("");
  const [track, setTrack] = useState("");
  const [platform, setPlatform] = useState("");
  const [follower, setFollower] = useState("");
  const [interest, setInterest] = useState("");
  const [rank, setRank] = useState("");
  const [format, setFormat] = useState("");
  const rows = bundles.flatMap((bundle) => bundle.items.map((item) => ({ bundle, item, product: productById.get(item.productId) })));
  const filtered = rows
    .filter((row) => !keyword || [row.bundle.kol.name, row.product?.productName, row.product?.productCode].join(" ").includes(keyword))
    .filter((row) => !institution || row.product?.institution === institution)
    .filter((row) => !track || row.product?.track === track)
    .filter((row) => !platform || row.bundle.kol.platforms.includes(platform))
    .filter((row) => !follower || row.bundle.kol.followerRange === follower)
    .filter((row) => !interest || row.item.interestLevel === interest)
    .filter((row) => !rank || row.item.rankType === rank)
    .filter((row) => !format || row.item.contentFormats.includes(format as ContentFormat));
  const institutions = Array.from(new Set(rows.map((row) => row.product?.institution ?? "").filter(Boolean)));
  const tracks = Array.from(new Set(rows.map((row) => row.product?.track ?? "").filter(Boolean)));
  const platforms = Array.from(new Set(bundles.flatMap((bundle) => bundle.kol.platforms)));
  const followers = Array.from(new Set(bundles.map((bundle) => bundle.kol.followerRange)));
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold sm:text-3xl">全部选择明细</h1>
      <FilterBar>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索达人昵称、产品名称、产品代码" className="h-11 rounded-lg border border-[#E9DDB8] px-3 text-sm" />
        <Select value={institution} onChange={setInstitution} options={["", ...institutions]} empty="全部机构" />
        <Select value={track} onChange={setTrack} options={["", ...tracks]} empty="全部赛道" />
        <Select value={platform} onChange={setPlatform} options={["", ...platforms]} empty="全部平台" />
        <Select value={follower} onChange={setFollower} options={["", ...followers]} empty="粉丝量" />
        <Select value={interest} onChange={setInterest} options={["", ...Object.keys(interestLevelLabels)]} labels={interestLevelLabels} empty="意向等级" />
        <Select value={rank} onChange={setRank} options={["", ...Object.keys(rankTypeLabels)]} labels={rankTypeLabels} empty="意向排序" />
        <Select value={format} onChange={setFormat} options={["", ...Object.keys(contentFormatLabels)]} labels={contentFormatLabels} empty="内容形式" />
      </FilterBar>
      <Table headers={["达人昵称", "主要平台", "粉丝量区间", "擅长内容方向", "机构", "赛道", "产品名称", "产品代码", "产品说明", "意向等级", "意向排序", "内容形式", "感兴趣原因", "补充备注", "提交时间"]}>
        {filtered.map((row) => (
          <tr key={row.item.id}>
            <td>{row.bundle.kol.name}</td><td>{joinZh(row.bundle.kol.platforms)}</td><td>{row.bundle.kol.followerRange}</td><td>{joinZh(row.bundle.kol.contentDirections)}</td><td>{row.product?.institution}</td><td>{row.product?.track}</td><td>{row.product?.productName}</td><td>{row.product?.productCode}</td><td>{displayProductDescription(row.product?.productDescription ?? "")}</td><td>{formatInterestLevel(row.item.interestLevel)}</td><td>{formatRankType(row.item.rankType)}</td><td>{formatContentFormats(row.item.contentFormats)}</td><td>{row.item.personalReason}</td><td>{row.item.remark}</td><td>{formatTime(row.bundle.response.submittedAt)}</td>
          </tr>
        ))}
      </Table>
    </AdminLayout>
  );
}

function ExportPage() {
  return (
    <AdminLayout>
      <section className="rounded-lg border border-[#F0DFAD] bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">数据导出</h1>
        <p className="mt-3 text-sm leading-7 text-[#4B5563]">导出文件包含产品汇总、达人汇总、选择明细、产品 x 达人矩阵、机构统计、赛道统计。产品代码按文本写入，空产品说明统一为“暂无产品说明”。</p>
        <a href="/api/admin/export" className="mt-5 inline-flex w-full justify-center rounded-lg bg-[#1F2937] px-5 py-3 text-sm font-semibold text-white sm:w-auto">
          导出全部数据 Excel
        </a>
      </section>
    </AdminLayout>
  );
}

function FilterBar({ children }: { children: ReactNode }) {
  return <section className="grid gap-3 rounded-lg border border-[#F0DFAD] bg-white p-3 shadow-sm sm:p-4 md:grid-cols-3 xl:grid-cols-6">{children}</section>;
}

function Select({ value, onChange, options, labels = {}, empty }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Partial<Record<string, string>>; empty: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-[#E9DDB8] bg-white px-3 text-sm">
      {options.map((option, index) => (
        <option key={`${option}-${index}`} value={option}>
          {option === "" ? empty : labels[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#F0DFAD] bg-white shadow-sm">
      <p className="border-b border-[#F0DFAD] bg-[#FFFDF5] px-3 py-2 text-xs text-[#8A6400] sm:hidden">
        表格可左右滑动查看完整字段
      </p>
      <div className="overflow-x-auto">
      <table className="min-w-[920px] border-collapse text-left text-sm">
        <thead className="bg-[#FFF7D6] text-[#5F4A12]">
          <tr>{headers.map((header) => <th key={header} className="whitespace-nowrap border-b border-[#F0DFAD] px-3 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="[&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-[#F4E9C6] [&_td]:px-3 [&_td]:py-3">{children}</tbody>
      </table>
      </div>
    </section>
  );
}
