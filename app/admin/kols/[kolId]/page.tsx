import { AdminLogin, SurveyAdmin } from "@/components/survey-admin";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getProducts, getSurveyResponseBundles } from "@/lib/survey-storage";

export const dynamic = "force-dynamic";

export default async function KolDetailPage({
  params,
}: {
  params: Promise<{ kolId: string }>;
}) {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;
  const [{ kolId }, products, bundles] = await Promise.all([
    params,
    getProducts(),
    getSurveyResponseBundles(),
  ]);
  return <SurveyAdmin products={products} bundles={bundles} view="kolDetail" kolId={kolId} />;
}
