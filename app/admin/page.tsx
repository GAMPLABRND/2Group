import AdminConsole from "./AdminConsole";
import { requirePagePermission } from "./_pageAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function AdminPage() {
  await requirePagePermission("/admin", ["ADMIN"], "ADMIN_MANAGE");
  return <AdminConsole />;
}
