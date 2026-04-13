"use client";

import { useState } from "react";
import type { StorageInfo, SubmissionRecord } from "@/lib/storage";
import { TextInput } from "@/components/ui";

type AdminDashboardProps = {
  submissions: SubmissionRecord[];
  storageInfo: StorageInfo;
};

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function mergeOther(main: string, other: string) {
  if (!other) {
    return main || "-";
  }

  return main ? `${main}；其他：${other}` : `其他：${other}`;
}

function escapeCsv(value: string) {
  const normalized = value.replaceAll('"', '""');
  return `"${normalized}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filterIncludes(value: string, keyword: string) {
  return value.toLowerCase().includes(keyword.toLowerCase());
}

function getTopItems(values: string[]) {
  const counter = new Map<string, number>();

  values.filter(Boolean).forEach((item) => {
    counter.set(item, (counter.get(item) ?? 0) + 1);
  });

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 3);
}

export function AdminDashboard({
  submissions,
  storageInfo,
}: AdminDashboardProps) {
  const [keyword, setKeyword] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedFollowerLevel, setSelectedFollowerLevel] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");

  const uniqueCodes = Array.from(
    new Set(submissions.map((item) => item.code).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));

  const uniqueTracks = Array.from(
    new Set(
      submissions.flatMap((item) => [
        ...item.tracks,
        item.tracks_other ? `其他：${item.tracks_other}` : "",
      ]),
    ),
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));

  const uniqueFollowerLevels = Array.from(
    new Set(submissions.map((item) => item.follower_level).filter(Boolean)),
  );

  const filteredSubmissions = submissions.filter((item) => {
    const matchedKeyword =
      !keyword ||
      [
        item.code,
        item.nickname,
        item.expertise_text,
        item.expertise_other,
        item.tracks_text,
        item.tracks_other,
        item.fund_companies_text,
        item.fund_companies_other,
        item.product_names_text,
        item.reasons_text,
        item.reasons_other,
      ].some((value) => filterIncludes(value, keyword));

    const matchedCode = !selectedCode || item.code === selectedCode;
    const matchedFollower =
      !selectedFollowerLevel || item.follower_level === selectedFollowerLevel;
    const matchedTrack =
      !selectedTrack ||
      item.tracks.includes(selectedTrack) ||
      `其他：${item.tracks_other}` === selectedTrack;

    return matchedKeyword && matchedCode && matchedFollower && matchedTrack;
  });

  const latestSubmission = filteredSubmissions[0]?.submit_time ?? submissions[0]?.submit_time;
  const topTracks = getTopItems(filteredSubmissions.flatMap((item) => item.tracks));
  const topCompanies = getTopItems(
    filteredSubmissions.flatMap((item) => item.fund_companies),
  );

  function handleReset() {
    setKeyword("");
    setSelectedCode("");
    setSelectedFollowerLevel("");
    setSelectedTrack("");
  }

  function handleExport() {
    const rows = [
      [
        "提交时间",
        "Code",
        "昵称",
        "擅长领域",
        "粉丝量级",
        "看好赛道",
        "基金公司",
        "产品名称",
        "推荐理由",
      ],
      ...filteredSubmissions.map((item) => [
        formatTime(item.submit_time),
        item.code || "-",
        item.nickname,
        mergeOther(item.expertise_text, item.expertise_other),
        item.follower_level,
        mergeOther(item.tracks_text, item.tracks_other),
        mergeOther(item.fund_companies_text, item.fund_companies_other),
        item.product_names_text || "-",
        mergeOther(item.reasons_text, item.reasons_other),
      ]),
    ];

    const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
    downloadCsv(`submissions-${timestamp}.csv`, rows);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[32px] border border-white/60 bg-grain p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-sage">
                OPERATION PANEL
              </p>
              <h1 className="font-display text-[34px] leading-tight text-ink sm:text-[42px]">
                提交数据查看台
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-muted">
                这里可以直接搜索、筛选、导出提交数据。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
              <div className="rounded-[24px] border border-line bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  总提交数
                </p>
                <p className="mt-2 font-display text-3xl text-ink">
                  {submissions.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-line bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  存储方式
                </p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  {storageInfo.label}
                </p>
              </div>
            </div>
          </div>
        </section>

        {!storageInfo.persistent ? (
          <section className="rounded-[24px] border border-[#e8cfae] bg-[#fff4e8] px-5 py-4 text-sm leading-7 text-[#7f5d2f] shadow-card">
            当前公网环境仍在使用本地文件存储：`{storageInfo.location}`。这种方式在
            Render 免费实例上不稳定，可能出现“提交成功但后台查不到”的情况。要让后台稳定显示，需要切换到
            Postgres 数据库。
          </section>
        ) : null}

        {submissions.length === 0 ? (
          <section className="card-surface soft-border rounded-[28px] p-8 text-center shadow-card">
            <p className="text-lg font-semibold text-ink">还没有提交记录</p>
            <p className="mt-2 text-sm text-muted">
              等填写者提交后，这里会自动显示最新数据。
            </p>
          </section>
        ) : (
          <>
            <section className="card-surface soft-border rounded-[28px] p-5 shadow-card">
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
                <TextInput
                  placeholder="搜索昵称、code、产品名称、赛道、基金公司"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
                <select
                  value={selectedCode}
                  onChange={(event) => setSelectedCode(event.target.value)}
                  className="field-transition w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-[15px] text-ink"
                >
                  <option value="">全部来源 code</option>
                  {uniqueCodes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedFollowerLevel}
                  onChange={(event) => setSelectedFollowerLevel(event.target.value)}
                  className="field-transition w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-[15px] text-ink"
                >
                  <option value="">全部粉丝量级</option>
                  {uniqueFollowerLevels.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTrack}
                  onChange={(event) => setSelectedTrack(event.target.value)}
                  className="field-transition w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-[15px] text-ink"
                >
                  <option value="">全部赛道</option>
                  {uniqueTracks.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3 text-sm text-muted">
                  <span className="rounded-full border border-line bg-white/70 px-3 py-1.5">
                    当前显示 {filteredSubmissions.length} 条
                  </span>
                  <span className="rounded-full border border-line bg-white/70 px-3 py-1.5">
                    覆盖 {uniqueCodes.length || 0} 个专属来源
                  </span>
                  <span className="rounded-full border border-line bg-white/70 px-3 py-1.5">
                    最近提交 {latestSubmission ? formatTime(latestSubmission) : "-"}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="field-transition min-h-11 rounded-full border border-line bg-white/70 px-5 py-2 text-sm font-semibold text-ink hover:-translate-y-0.5 hover:bg-white"
                  >
                    重置筛选
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="field-transition min-h-11 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-moss"
                  >
                    导出 CSV
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <article className="card-surface soft-border rounded-[24px] p-5 shadow-card">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  当前热门赛道
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {topTracks.length > 0 ? (
                    topTracks.map(([label, count]) => (
                      <span
                        key={label}
                        className="rounded-full border border-line bg-white/75 px-3 py-1.5 text-sm text-ink"
                      >
                        {label} · {count}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">暂无可统计赛道</span>
                  )}
                </div>
              </article>

              <article className="card-surface soft-border rounded-[24px] p-5 shadow-card">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  当前热门基金公司
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {topCompanies.length > 0 ? (
                    topCompanies.map(([label, count]) => (
                      <span
                        key={label}
                        className="rounded-full border border-line bg-white/75 px-3 py-1.5 text-sm text-ink"
                      >
                        {label} · {count}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">暂无可统计基金公司</span>
                  )}
                </div>
              </article>
            </section>

            {filteredSubmissions.length === 0 ? (
              <section className="card-surface soft-border rounded-[28px] p-8 text-center shadow-card">
                <p className="text-lg font-semibold text-ink">没有匹配到数据</p>
                <p className="mt-2 text-sm text-muted">
                  你可以调整搜索词或重置筛选条件再试一次。
                </p>
              </section>
            ) : (
              <>
                <section className="grid gap-4 lg:hidden">
                  {filteredSubmissions.map((item) => (
                    <article
                      key={item.id}
                      className="card-surface soft-border rounded-[24px] p-5 shadow-card"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-ink">
                            {item.nickname}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {formatTime(item.submit_time)}
                          </p>
                        </div>
                        <span className="rounded-full border border-line bg-white/70 px-3 py-1 text-xs text-muted">
                          {item.code || "无 code"}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm leading-7 text-ink">
                        <p><span className="font-semibold">擅长领域：</span>{mergeOther(item.expertise_text, item.expertise_other)}</p>
                        <p><span className="font-semibold">粉丝量级：</span>{item.follower_level}</p>
                        <p><span className="font-semibold">看好赛道：</span>{mergeOther(item.tracks_text, item.tracks_other)}</p>
                        <p><span className="font-semibold">基金公司：</span>{mergeOther(item.fund_companies_text, item.fund_companies_other)}</p>
                        <p><span className="font-semibold">产品名称：</span>{item.product_names_text || "-"}</p>
                        <p><span className="font-semibold">推荐理由：</span>{mergeOther(item.reasons_text, item.reasons_other)}</p>
                      </div>
                    </article>
                  ))}
                </section>

                <section className="hidden overflow-hidden rounded-[28px] border border-line bg-white/75 shadow-card lg:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-ink">
                      <thead className="border-b border-line bg-sand/70 text-xs uppercase tracking-[0.14em] text-muted">
                        <tr>
                          <th className="px-4 py-4 font-medium">提交时间</th>
                          <th className="px-4 py-4 font-medium">Code</th>
                          <th className="px-4 py-4 font-medium">昵称</th>
                          <th className="px-4 py-4 font-medium">擅长领域</th>
                          <th className="px-4 py-4 font-medium">粉丝量级</th>
                          <th className="px-4 py-4 font-medium">看好赛道</th>
                          <th className="px-4 py-4 font-medium">基金公司</th>
                          <th className="px-4 py-4 font-medium">产品名称</th>
                          <th className="px-4 py-4 font-medium">推荐理由</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubmissions.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-line/80 align-top last:border-b-0"
                          >
                            <td className="px-4 py-4 text-muted">
                              {formatTime(item.submit_time)}
                            </td>
                            <td className="px-4 py-4">{item.code || "-"}</td>
                            <td className="px-4 py-4 font-semibold">
                              {item.nickname}
                            </td>
                            <td className="px-4 py-4">
                              {mergeOther(item.expertise_text, item.expertise_other)}
                            </td>
                            <td className="px-4 py-4">{item.follower_level}</td>
                            <td className="px-4 py-4">
                              {mergeOther(item.tracks_text, item.tracks_other)}
                            </td>
                            <td className="px-4 py-4">
                              {mergeOther(
                                item.fund_companies_text,
                                item.fund_companies_other,
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {item.product_names_text || "-"}
                            </td>
                            <td className="px-4 py-4">
                              {mergeOther(item.reasons_text, item.reasons_other)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
