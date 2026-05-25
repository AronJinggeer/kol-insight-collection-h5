import { AdminLogin, SurveyAdmin } from "@/components/survey-admin";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getProducts, getSurveyResponseBundles } from "@/lib/survey-storage";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;
  const [{ productId }, products, bundles] = await Promise.all([
    params,
    getProducts(),
    getSurveyResponseBundles(),
  ]);
  return <SurveyAdmin products={products} bundles={bundles} view="productDetail" productId={productId} />;
}
