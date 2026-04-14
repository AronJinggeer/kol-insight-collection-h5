export const expertiseOptions = [
  "宏观",
  "基金投资",
  "股票投资",
  "ETF",
  "资产配置",
  "黄金",
  "港股/美股",
  "固收",
  "行业研究",
  "其他",
] as const;

export const followerLevelOptions = [
  "1万以下",
  "1万到5万",
  "5万到10万",
  "10万到50万",
  "50万到100万",
  "100万以上",
] as const;

export const trackOptions = [
  "黄金",
  "红利",
  "高股息",
  "AI",
  "机器人",
  "半导体",
  "创新药",
  "港股",
  "美股科技",
  "消费",
  "出海",
  "新能源",
  "军工",
  "债券",
  "REITs",
  "其他",
] as const;

export const fundCompanyOptions = [
  "汇添富",
  "大成",
  "博时",
  "富国",
  "广发",
  "华富",
  "天弘",
  "银华",
  "南方",
  "鹏华",
  "招商",
  "中银",
  "嘉实",
  "工银瑞信",
  "建信",
  "农银汇理",
  "上银",
  "其他",
] as const;

export const reasonOptions = [
  "赛道景气度高",
  "长期配置价值强",
  "短中期催化明确",
  "基金经理能力突出",
  "产品历史表现稳健",
  "回撤控制较好",
  "适合作为底仓配置",
  "指数工具性强",
  "估值仍有空间",
  "攻守兼备",
  "其他",
] as const;

export const maxSelectionMap = {
  tracks: 5,
  fund_companies: 6,
} as const;

export const productFieldKeys = [
  "product_name_1",
  "product_name_2",
  "product_name_3",
  "product_name_4",
  "product_name_5",
  "product_name_6",
] as const;

export type ProductFieldName = (typeof productFieldKeys)[number];

export type MultiFieldName =
  | "expertise"
  | "tracks"
  | "fund_companies"
  | "reasons";

export type SubmissionPayload = {
  code: string;
  nickname: string;
  expertise: string[];
  expertise_other: string;
  follower_level: string;
  tracks: string[];
  tracks_other: string;
  fund_companies: string[];
  fund_companies_other: string;
  product_name_1: string;
  product_name_2: string;
  product_name_3: string;
  product_name_4: string;
  product_name_5: string;
  product_name_6: string;
  reasons: string[];
  reasons_other: string;
};

export const emptyFormData: SubmissionPayload = {
  code: "",
  nickname: "",
  expertise: [],
  expertise_other: "",
  follower_level: "",
  tracks: [],
  tracks_other: "",
  fund_companies: [],
  fund_companies_other: "",
  product_name_1: "",
  product_name_2: "",
  product_name_3: "",
  product_name_4: "",
  product_name_5: "",
  product_name_6: "",
  reasons: [],
  reasons_other: "",
};
