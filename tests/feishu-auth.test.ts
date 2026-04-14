import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchFeishuTenantAccessToken,
  refreshFeishuUserAccessToken,
  getFeishuAuthMode,
  isFeishuStorageConfigured,
  mapFeishuMatrixRows,
} from "../lib/feishu-auth.ts";

test("prefers direct user access token when both auth modes are available", () => {
  assert.equal(
    getFeishuAuthMode({
      userAccessToken: "user-token",
      appId: "cli_xxx",
      appSecret: "secret",
    }),
    "user",
  );
});

test("treats refreshable user auth as user mode when app credentials are present", () => {
  assert.equal(
    getFeishuAuthMode({
      userRefreshToken: "refresh-token",
      appId: "cli_xxx",
      appSecret: "secret",
    }),
    "user",
  );
});

test("treats storage as configured when app token, table id and user token exist", () => {
  assert.equal(
    isFeishuStorageConfigured({
      appToken: "app-token",
      tableId: "tbl-token",
      userAccessToken: "user-token",
    }),
    true,
  );
});

test("treats storage as configured when app token, table id and refreshable user auth exist", () => {
  assert.equal(
    isFeishuStorageConfigured({
      appToken: "app-token",
      tableId: "tbl-token",
      userRefreshToken: "refresh-token",
      appId: "cli_xxx",
      appSecret: "secret",
    }),
    true,
  );
});

test("maps base v3 matrix rows back to field objects", () => {
  assert.deepEqual(
    mapFeishuMatrixRows(
      ["id", "nickname", "code"],
      [["1", "静哥er", "KOL001"]],
    ),
    [
      {
        id: "1",
        nickname: "静哥er",
        code: "KOL001",
      },
    ],
  );
});

test("fetches tenant token with the internal token endpoint", async () => {
  let calledUrl = "";
  let calledBody = "";
  let calledContentType = "";

  const result = await fetchFeishuTenantAccessToken({
    appId: "cli_test",
    appSecret: "secret_test",
    openBaseUrl: "https://open.feishu.cn",
    fetchImpl: async (input, init) => {
      calledUrl = String(input);
      calledBody = String(init?.body || "");
      calledContentType = String(
        new Headers(init?.headers).get("Content-Type") || "",
      );

      return new Response(
        JSON.stringify({
          code: 0,
          tenant_access_token: "tenant-token",
          expire: 7200,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },
  });

  assert.equal(
    calledUrl,
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
  );
  assert.equal(calledContentType, "application/json");
  assert.match(calledBody, /"app_id":"cli_test"/);
  assert.match(calledBody, /"app_secret":"secret_test"/);
  assert.equal(result.token, "tenant-token");
  assert.ok(result.expiresAt > Date.now());
});

test("refreshes user access token with the refresh endpoint", async () => {
  let calledUrl = "";
  let calledBody = "";
  let authorizationHeader = "";

  const result = await refreshFeishuUserAccessToken({
    accessToken: "expired-user-token",
    refreshToken: "refresh-token",
    appId: "cli_test",
    appSecret: "secret_test",
    openBaseUrl: "https://open.feishu.cn",
    fetchImpl: async (input, init) => {
      calledUrl = String(input);
      calledBody = String(init?.body || "");
      authorizationHeader = String(
        new Headers(init?.headers).get("Authorization") || "",
      );

      return new Response(
        JSON.stringify({
          code: 0,
          msg: "success",
          data: {
            access_token: "new-access-token",
            expires_in: 7200,
            refresh_token: "new-refresh-token",
            refresh_expires_in: 2591940,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    },
  });

  assert.equal(
    calledUrl,
    "https://open.feishu.cn/open-apis/authen/v1/refresh_access_token",
  );
  assert.equal(authorizationHeader, "Bearer expired-user-token");
  assert.match(calledBody, /"grant_type":"refresh_token"/);
  assert.match(calledBody, /"client_id":"cli_test"/);
  assert.match(calledBody, /"client_secret":"secret_test"/);
  assert.match(calledBody, /"refresh_token":"refresh-token"/);
  assert.equal(result.token, "new-access-token");
  assert.equal(result.refreshToken, "new-refresh-token");
  assert.ok(result.expiresAt > Date.now());
  assert.ok(result.refreshExpiresAt > result.expiresAt);
});
