const DEFAULT_FEISHU_OPEN_BASE_URL = "https://open.feishu.cn";

type FetchLike = typeof fetch;

export type FeishuAuthMode = "user" | "tenant";

type FeishuAuthConfig = {
  userAccessToken?: string;
  userRefreshToken?: string;
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
  app_access_token?: string;
  tenant_access_token?: string;
  expire?: number;
};

type UserAccessTokenPayload = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
};

type UserAccessTokenResponse = {
  code?: number;
  msg?: string;
  message?: string;
  data?: UserAccessTokenPayload;
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
};

export function getFeishuAuthMode(
  config: FeishuAuthConfig,
): FeishuAuthMode | null {
  if (
    config.userRefreshToken &&
    config.appId &&
    config.appSecret
  ) {
    return "user";
  }

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

export async function fetchFeishuAppAccessToken({
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
    `${openBaseUrl}/open-apis/auth/v3/app_access_token/internal`,
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
  const token = result.app_access_token || result.tenant_access_token;

  if (!response.ok || result.code !== 0 || !token) {
    throw new Error(
      result.message ||
        result.msg ||
        "Failed to get Feishu app_access_token",
    );
  }

  return {
    token,
    expiresAt: Date.now() + (result.expire || 7200) * 1000,
  };
}

export async function refreshFeishuUserAccessToken({
  appAccessToken,
  refreshToken,
  appId,
  appSecret,
  openBaseUrl = DEFAULT_FEISHU_OPEN_BASE_URL,
  fetchImpl = fetch,
}: {
  appAccessToken: string;
  refreshToken: string;
  appId: string;
  appSecret: string;
  openBaseUrl?: string;
  fetchImpl?: FetchLike;
}) {
  const response = await fetchImpl(
    `${openBaseUrl}/open-apis/authen/v1/refresh_access_token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: appId,
        client_secret: appSecret,
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    },
  );

  const result = (await response.json()) as UserAccessTokenResponse;
  const payload = result.data || result;

  if (
    !response.ok ||
    result.code !== 0 ||
    !payload.access_token ||
    !payload.refresh_token
  ) {
    throw new Error(
      result.message ||
        result.msg ||
        "Failed to refresh Feishu user_access_token",
    );
  }

  return {
    token: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (payload.expires_in || 7200) * 1000,
    refreshExpiresAt:
      Date.now() + (payload.refresh_expires_in || 2591940) * 1000,
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
