import { AdminDashboard } from "@/components/admin-dashboard";
import { getSubmissions } from "@/lib/storage";

export default async function AdminPage() {
  const submissions = await getSubmissions();

  return <AdminDashboard submissions={submissions} />;
}
