import { AdminDashboard } from "@/components/admin-dashboard";
import { getStorageInfo, getSubmissions } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const submissions = await getSubmissions();
  const storageInfo = getStorageInfo();

  return <AdminDashboard submissions={submissions} storageInfo={storageInfo} />;
}
