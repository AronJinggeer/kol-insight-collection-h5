export type Product = {
  id: string;
  sourceRow: number;
  institution: string;
  track: string;
  productName: string;
  productCode: string;
  productDescription: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KOL = {
  id: string;
  name: string;
  platforms: string[];
  followerRange: string;
  contentDirections: string[];
  createdAt: string;
  updatedAt: string;
};

export type InterestLevel =
  | "strong"
  | "medium"
  | "weak"
  | "need_more_info";

export type RankType =
  | "top1"
  | "top2"
  | "top3"
  | "top4"
  | "top5"
  | "backup";

export type ContentFormat =
  | "xiaohongshu_note"
  | "community_post"
  | "private_domain"
  | "other";

export type SurveyResponse = {
  id: string;
  kolId: string;
  status: "submitted";
  submittedAt: string;
  confirmedIntentOnly: boolean;
  confirmedCompliance: boolean;
  confirmedFinalCommunication: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SurveyResponseItem = {
  id: string;
  responseId: string;
  productId: string;
  interestLevel: InterestLevel;
  rankType: RankType;
  personalReason: string;
  contentFormats: ContentFormat[];
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type SurveyResponseBundle = {
  kol: KOL;
  response: SurveyResponse;
  items: SurveyResponseItem[];
};

export type SurveySubmitPayload = {
  kol: {
    name: string;
    platforms: string[];
    followerRange: string;
    contentDirections: string[];
  };
  confirmations: {
    confirmedIntentOnly: boolean;
    confirmedCompliance: boolean;
    confirmedFinalCommunication: boolean;
  };
  items: Array<{
    productId: string;
    interestLevel: InterestLevel;
    rankType: RankType;
    personalReason?: string;
    contentFormats: ContentFormat[];
    remark?: string;
  }>;
};
