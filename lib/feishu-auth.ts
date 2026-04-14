const DEFAULT_FEISHU_OPEN_BASE_URL = "https://open.feishu.cn";

type FetchLike = typeof fetch;

export type FeishuAuthMode = "user" | "tenant";

type FeishuAuthConfig = {
  userAccessToken?: string;
  appId?: string;
  appSecret?: string;
};

type FeishuStorageConfig = FeishuAuthConfig & {
  appToken?: string;
  tableId?: string;
};

type TenantTokenResponse = {
  code?: number;
  msg?: string;
  message?: string;
  tenant_access_token?: string;
  expire?: number;
};

export function getFeishuAuthMode(
  config: FeishuAuthConfig,
): FeishuAuthMode | null {
  if (config.userAccessToken) {
    return "user";
  }

  if (config.appId && config.appSecret) {
    return "tenant";
  }

  return null;
}

export function isFeishuStorageConfigured(config: FeishuStorageConfig) {
  return Boolean(
    config.appToken &&
      config.tableId &&
      getFeishuAuthMode(config),
  );
}

export async function fetchFeishuTenantAccessToken({
  appId,
  appSecret,
  openBaseUrl = DEFAULT_FEISHU_OPEN_BASE_URL,
  fetchImpl = fetch,
}: {
  appId: string;
  appSecret: string;
  openBaseUrl?: string;
  fetchImpl?: FetchLike;
}) {
  const response = await fetchImpl(
    `${openBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
      cache: "no-store",
    },
  );

  const result = (await response.json()) as TenantTokenResponse;

  if (!response.ok || result.code !== 0 || !result.tenant_access_token) {
    throw new Error(
      result.message ||
        result.msg ||
        "Failed to get Feishu tenant_access_token",
    );
  }

  return {
    token: result.tenant_access_token,
    expiresAt: Date.now() + (result.expire || 7200) * 1000,
  };
}

export function mapFeishuMatrixRows(
  fields: string[],
  rows: unknown[][],
): Array<Record<string, unknown>> {
  return rows.map((row) =>
    Object.fromEntries(fields.map((field, index) => [field, row[index]])),
  );
}
