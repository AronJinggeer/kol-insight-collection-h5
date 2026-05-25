import { AdminLogin, SurveyAdmin } from "@/components/survey-admin";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getProducts, getSurveyResponseBundles } from "@/lib/survey-storage";

export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;
  const [products, bundles] = await Promise.all([getProducts(), getSurveyResponseBundles()]);
  return <SurveyAdmin products={products} bundles={bundles} view="export" />;
}
