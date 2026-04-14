"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SubmissionPayload,
  emptyFormData,
  expertiseOptions,
  followerLevelOptions,
  fundCompanyOptions,
  maxSelectionMap,
  MultiFieldName,
  productFieldKeys,
  reasonOptions,
  trackOptions,
} from "@/lib/form-config";
import {
  hasErrors,
  normalizeSubmission,
  validateSubmission,
  type FieldErrors,
} from "@/lib/validation";
import {
  FieldShell,
  PillOption,
  PrimaryButton,
  SectionCard,
  TextInput,
} from "@/components/ui";

function toggleValue(
  current: string[],
  value: string,
  max?: number,
): { nextValues: string[]; blocked: boolean } {
  if (current.includes(value)) {
    return { nextValues: current.filter((item) => item !== value), blocked: false };
  }

  if (max && current.length >= max) {
    return { nextValues: current, blocked: true };
  }

  return { nextValues: [...current, value], blocked: false };
}

function isLimitedField(
  field: MultiFieldName,
): field is keyof typeof maxSelectionMap {
  return field === "tracks" || field === "fund_companies";
}

export function FormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const [formData, setFormData] = useState<SubmissionPayload>({
    ...emptyFormData,
    code,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [selectionHints, setSelectionHints] = useState<
    Partial<Record<"tracks" | "fund_companies", string>>
  >({});

  const headerBadge = useMemo(() => {
    if (!code) {
      return "公开填写链接";
    }

    return `专属链接已识别 · ${code}`;
  }, [code]);

  function setField<K extends keyof SubmissionPayload>(
    key: K,
    value: SubmissionPayload[K],
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }

      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleMultiSelect(field: MultiFieldName, value: string) {
    const limit = isLimitedField(field) ? maxSelectionMap[field] : undefined;
    const result = toggleValue(formData[field], value, limit);

    if (result.blocked) {
      if (isLimitedField(field)) {
        setSelectionHints((prev) => ({
          ...prev,
          [field]: `此题最多选择 ${limit} 项`,
        }));
      }
      return;
    }

    if (isLimitedField(field)) {
      setSelectionHints((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
    setField(field, result.nextValues as SubmissionPayload[typeof field]);

    if (value === "其他" && formData[field].includes("其他")) {
      const otherKey = `${field}_other` as keyof SubmissionPayload;
      setField(otherKey, "" as SubmissionPayload[keyof SubmissionPayload]);
    }
  }

  function handleSingleSelect(value: string) {
    setField("follower_level", value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = normalizeSubmission({
      ...formData,
      code,
    });

    const nextErrors = validateSubmission(payload);
    setErrors(nextErrors);
    setSubmitMessage("");

    if (hasErrors(nextErrors)) {
      setSubmitMessage("还有必填项未完善，请检查后再提交。");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        success: boolean;
        message: string;
      };

      if (!response.ok || !result.success) {
        setSubmitMessage(result.message || "提交失败，请稍后重试。");
        return;
      }

      const query = code ? `?code=${encodeURIComponent(code)}` : "";
      router.push(`/success${query}`);
    } catch {
      setSubmitMessage("网络或服务异常，暂时无法提交，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-grain p-6 shadow-card sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" />
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-white/70 bg-white/60 px-3 py-1 text-xs tracking-[0.2em] text-muted">
              COLLECTION BRIEF
            </span>
            <div className="space-y-3">
              <h1 className="font-display text-[34px] leading-tight text-ink sm:text-[42px]">
                未来赛道与产品观点征集
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-muted">
                邀请各位优质创作者分享未来看好的赛道与品类等内容噢～
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted">
              <span className="rounded-full border border-line bg-white/65 px-3 py-1.5">
                {headerBadge}
              </span>
              <span className="rounded-full border border-line bg-white/65 px-3 py-1.5">
                预计 2-3 分钟
              </span>
            </div>
          </div>
        </section>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <SectionCard
            eyebrow="Part 01"
            title="基础信息"
          >
            <div className="space-y-6">
              <FieldShell
                label="1. 大V昵称"
                required
                error={errors.nickname}
              >
                <TextInput
                  placeholder="请输入你的昵称"
                  value={formData.nickname}
                  onChange={(event) => setField("nickname", event.target.value)}
                />
              </FieldShell>

              <FieldShell
                label="2. 擅长领域"
                required
                hint="可多选"
                error={errors.expertise}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {expertiseOptions.map((item) => (
                    <PillOption
                      key={item}
                      label={item}
                      checked={formData.expertise.includes(item)}
                      onClick={() => handleMultiSelect("expertise", item)}
                    />
                  ))}
                </div>
                {formData.expertise.includes("其他") ? (
                  <TextInput
                    placeholder="请补充填写"
                    value={formData.expertise_other}
                    onChange={(event) =>
                      setField("expertise_other", event.target.value)
                    }
                  />
                ) : null}
                {errors.expertise_other ? (
                  <p className="text-sm text-accent">{errors.expertise_other}</p>
                ) : null}
              </FieldShell>

              <FieldShell
                label="3. 粉丝量级"
                required
                error={errors.follower_level}
              >
                <div className="grid grid-cols-2 gap-3">
                  {followerLevelOptions.map((item) => (
                    <PillOption
                      key={item}
                      label={item}
                      type="radio"
                      checked={formData.follower_level === item}
                      onClick={() => handleSingleSelect(item)}
                    />
                  ))}
                </div>
              </FieldShell>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Part 02"
            title="核心征集内容"
          >
            <div className="space-y-8">
              <FieldShell
                label={`4. 未来 6 到 12 个月，你最看好的 ${maxSelectionMap.tracks} 个赛道`}
                required
                hint={`至少选择 1 项，最多选择 ${maxSelectionMap.tracks} 项`}
                error={errors.tracks}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {trackOptions.map((item) => {
                    const limitReached =
                      formData.tracks.length >= maxSelectionMap.tracks &&
                      !formData.tracks.includes(item);

                    return (
                      <PillOption
                        key={item}
                        label={item}
                        checked={formData.tracks.includes(item)}
                        disabled={limitReached}
                        onClick={() => handleMultiSelect("tracks", item)}
                      />
                    );
                  })}
                </div>
                {selectionHints.tracks ? (
                  <p className="text-sm text-accent">{selectionHints.tracks}</p>
                ) : null}
                {formData.tracks.includes("其他") ? (
                  <TextInput
                    placeholder="请补充填写"
                    value={formData.tracks_other}
                    onChange={(event) => setField("tracks_other", event.target.value)}
                  />
                ) : null}
                {errors.tracks_other ? (
                  <p className="text-sm text-accent">{errors.tracks_other}</p>
                ) : null}
              </FieldShell>

              <FieldShell
                label="5. 你最愿意推荐的基金公司是哪几家"
                required
                hint={`至少选择 1 家，最多选择 ${maxSelectionMap.fund_companies} 家`}
                error={errors.fund_companies}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {fundCompanyOptions.map((item) => {
                    const limitReached =
                      formData.fund_companies.length >= maxSelectionMap.fund_companies &&
                      !formData.fund_companies.includes(item);

                    return (
                      <PillOption
                        key={item}
                        label={item}
                        checked={formData.fund_companies.includes(item)}
                        disabled={limitReached}
                        onClick={() => handleMultiSelect("fund_companies", item)}
                      />
                    );
                  })}
                </div>
                {formData.fund_companies.includes("其他") ? (
                  <TextInput
                    placeholder="请补充填写"
                    value={formData.fund_companies_other}
                    onChange={(event) =>
                      setField("fund_companies_other", event.target.value)
                    }
                  />
                ) : null}
                {selectionHints.fund_companies ? (
                  <p className="text-sm text-accent">
                    {selectionHints.fund_companies}
                  </p>
                ) : null}
                {errors.fund_companies_other ? (
                  <p className="text-sm text-accent">
                    {errors.fund_companies_other}
                  </p>
                ) : null}
              </FieldShell>

              <div className="grid gap-4">
                <FieldShell
                  label="6. 对应具体产品名称是什么"
                  hint="选填，可填写 1 到 6 个具体产品名称"
                >
                  <div className="grid gap-3">
                    {productFieldKeys.map((field, index) => (
                      <TextInput
                        key={field}
                        placeholder={`请输入产品名称 ${index + 1}`}
                        value={formData[field]}
                        onChange={(event) =>
                          setField(field, event.target.value)
                        }
                      />
                    ))}
                  </div>
                </FieldShell>
              </div>

              <FieldShell
                label="7. 你推荐这个产品的核心理由是什么"
                required
                hint="可多选"
                error={errors.reasons}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {reasonOptions.map((item) => (
                    <PillOption
                      key={item}
                      label={item}
                      checked={formData.reasons.includes(item)}
                      onClick={() => handleMultiSelect("reasons", item)}
                    />
                  ))}
                </div>
                {formData.reasons.includes("其他") ? (
                  <TextInput
                    placeholder="请补充填写"
                    value={formData.reasons_other}
                    onChange={(event) => setField("reasons_other", event.target.value)}
                  />
                ) : null}
                {errors.reasons_other ? (
                  <p className="text-sm text-accent">{errors.reasons_other}</p>
                ) : null}
              </FieldShell>
            </div>
          </SectionCard>

          <div className="card-surface soft-border rounded-[28px] p-5 shadow-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ink">提交前确认</p>
                <p className="text-sm text-muted">
                  系统会自动带上当前链接中的专属参数，并记录提交时间。
                </p>
              </div>
              <PrimaryButton
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto sm:min-w-40"
              >
                {submitting ? "提交中..." : "提交"}
              </PrimaryButton>
            </div>
            {submitMessage ? (
              <p className="mt-4 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3 text-sm text-accent">
                {submitMessage}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
