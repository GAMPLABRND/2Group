import { requireRole } from "@/lib/auth";
import RecordsClient from "./RecordsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function RecordsPage() {
  const session = await requireRole(["ADMIN", "TESTER", "APPROVER"], "USE_RECORD_VIEW", "PAGE:/records");
  return <RecordsClient session={session} />;
}
