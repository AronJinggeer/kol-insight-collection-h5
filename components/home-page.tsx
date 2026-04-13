"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/ui";

export function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  function goToForm() {
    const query = code ? `?code=${encodeURIComponent(code)}` : "";
    router.push(`/form${query}`);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col justify-between rounded-[32px] border border-white/60 bg-grain p-6 shadow-card sm:min-h-[680px] sm:p-10">
        <div className="flex min-h-full flex-1 flex-col justify-between">
          <header className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/70 bg-white/60 px-3 py-1 text-xs tracking-[0.24em] text-muted">
                EDITORIAL COLLECTION
              </span>
              <span className="rounded-full border border-line bg-white/60 px-3 py-1 text-xs text-muted">
                预计填写 2-3 分钟
              </span>
              {code ? (
                <span className="rounded-full border border-line bg-white/60 px-3 py-1 text-xs text-muted">
                  专属链接已识别
                </span>
              ) : null}
            </div>
          </header>

          <section className="flex flex-1 items-center py-10 sm:py-14">
            <div className="max-w-3xl space-y-6">
              <h1 className="font-display text-[46px] leading-[0.98] text-ink sm:text-[68px]">
                未来赛道与产品观点
                <br />
                征集
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted sm:text-[22px] sm:leading-9">
                邀请各位优质创作者分享未来看好的赛道与品类等内容噢～
              </p>
            </div>
          </section>

          <footer className="flex flex-col gap-4 border-t border-white/60 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">本次填写预计 2 到 3 分钟</p>
            </div>
            <PrimaryButton
              onClick={goToForm}
              className="w-full sm:w-auto sm:min-w-44"
            >
              立即填写
            </PrimaryButton>
          </footer>
        </div>
      </div>
    </main>
  );
}
