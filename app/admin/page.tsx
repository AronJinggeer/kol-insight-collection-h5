import { AdminDashboard } from "@/components/admin-dashboard";
import { getSubmissions } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const submissions = await getSubmissions();

  return <AdminDashboard submissions={submissions} />;
}
