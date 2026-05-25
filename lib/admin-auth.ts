import { cookies } from "next/headers";

const COOKIE_NAME = "survey_admin_auth";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

export async function isAdminAuthenticated() {
  const password = getAdminPassword();
  if (!password) return false;
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === password;
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}
