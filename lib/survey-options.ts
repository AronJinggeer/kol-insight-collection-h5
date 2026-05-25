import type { ContentFormat, InterestLevel, RankType } from "./survey-types.ts";

export const platformOptions = [
  "小红书",
  "抖音",
  "视频号",
  "公众号",
  "B站",
  "微博",
  "雪球",
  "京东金融社区",
  "社群 / 私域",
  "其他",
];

export const followerRangeOptions = [
  "1万以下",
  "1万-5万",
  "5万-10万",
  "10万-30万",
  "30万-50万",
  "50万以上",
];

export const contentDirectionOptions = [
  "黄金",
  "基金",
  "ETF",
  "股票",
  "红利",
  "科技",
  "AI",
  "半导体",
  "机器人",
  "创新药",
  "宏观",
  "资产配置",
  "低风险理财",
  "社区互动",
  "直播陪伴",
  "其他",
];

export const institutionFilterOptions = [
  "天弘",
  "广发",
  "富国",
  "南方",
  "博时",
  "招商",
  "银华",
  "汇添富",
  "大成",
  "鹏华",
  "中银",
  "华富",
  "嘉实",
  "工银",
  "上银",
  "建信",
  "农银",
];

export const interestLevelLabels: Record<InterestLevel, string> = {
  strong: "强意向，愿意重点了解",
  medium: "中意向，可以考虑",
  weak: "弱意向，先观察",
  need_more_info: "需要更多资料后判断",
};

export const rankTypeLabels: Record<RankType, string> = {
  top1: "第1意向",
  top2: "第2意向",
  top3: "第3意向",
  top4: "第4意向",
  top5: "第5意向",
  backup: "备选",
};

export const contentFormatLabels: Record<ContentFormat, string> = {
  xiaohongshu_note: "小红书笔记",
  community_post: "社区帖子",
  private_domain: "朋友圈 / 私域",
  other: "其他",
};

export const interestLevelScore: Record<InterestLevel, number> = {
  strong: 100,
  medium: 70,
  weak: 40,
  need_more_info: 30,
};

export const rankTypeScore: Record<RankType, number> = {
  top1: 50,
  top2: 40,
  top3: 30,
  top4: 20,
  top5: 10,
  backup: 0,
};

export const topRankTypes: RankType[] = ["top1", "top2", "top3", "top4", "top5"];
export const surveySelectionLimits = {
  min: 3,
  max: 8,
} as const;

export function deriveInterestLevelFromRank(rankType: RankType): InterestLevel {
  if (rankType === "top1" || rankType === "top2") return "strong";
  if (rankType === "top3" || rankType === "top4" || rankType === "top5") {
    return "medium";
  }
  return "weak";
}
