import { SubmissionPayload, maxSelectionMap } from "@/lib/form-config";

export type FieldErrors = Partial<Record<keyof SubmissionPayload, string>>;

function hasOtherSelected(values: string[]) {
  return values.includes("其他");
}

function requireOtherText(values: string[], otherText: string) {
  return !hasOtherSelected(values) || otherText.trim().length > 0;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeSubmission(
  payload:
    | Partial<Record<keyof SubmissionPayload, unknown>>
    | Record<string, unknown>,
): SubmissionPayload {
  return {
    code: normalizeText(payload.code),
    nickname: normalizeText(payload.nickname),
    expertise: normalizeArray(payload.expertise),
    expertise_other: normalizeText(payload.expertise_other),
    follower_level: normalizeText(payload.follower_level),
    tracks: normalizeArray(payload.tracks),
    tracks_other: normalizeText(payload.tracks_other),
    fund_companies: normalizeArray(payload.fund_companies),
    fund_companies_other: normalizeText(payload.fund_companies_other),
    product_name_1: normalizeText(payload.product_name_1),
    product_name_2: normalizeText(payload.product_name_2),
    product_name_3: normalizeText(payload.product_name_3),
    product_name_4: normalizeText(payload.product_name_4),
    product_name_5: normalizeText(payload.product_name_5),
    product_name_6: normalizeText(payload.product_name_6),
    reasons: normalizeArray(payload.reasons),
    reasons_other: normalizeText(payload.reasons_other),
  };
}

export function validateSubmission(payload: SubmissionPayload): FieldErrors {
  const errors: FieldErrors = {};

  if (!payload.nickname.trim()) {
    errors.nickname = "请填写大V昵称";
  }

  if (payload.expertise.length < 1) {
    errors.expertise = "请至少选择 1 项擅长领域";
  } else if (!requireOtherText(payload.expertise, payload.expertise_other)) {
    errors.expertise_other = "已选择“其他”，请补充说明";
  }

  if (!payload.follower_level) {
    errors.follower_level = "请选择粉丝量级";
  }

  if (payload.tracks.length < 1) {
    errors.tracks = "请至少选择 1 个看好赛道";
  } else if (payload.tracks.length > maxSelectionMap.tracks) {
    errors.tracks = "最多选择 3 个赛道";
  } else if (!requireOtherText(payload.tracks, payload.tracks_other)) {
    errors.tracks_other = "已选择“其他”，请补充说明";
  }

  if (payload.fund_companies.length < 1) {
    errors.fund_companies = "请至少选择 1 家基金公司";
  } else if (
    payload.fund_companies.length > maxSelectionMap.fund_companies
  ) {
    errors.fund_companies = "最多选择 3 家基金公司";
  } else if (
    !requireOtherText(payload.fund_companies, payload.fund_companies_other)
  ) {
    errors.fund_companies_other = "已选择“其他”，请补充说明";
  }

  if (payload.reasons.length < 1) {
    errors.reasons = "请至少选择 1 个推荐理由";
  } else if (!requireOtherText(payload.reasons, payload.reasons_other)) {
    errors.reasons_other = "已选择“其他”，请补充说明";
  }

  return errors;
}

export function hasErrors(errors: FieldErrors) {
  return Object.keys(errors).length > 0;
}
