import { requireRole } from "@/lib/auth";
import NewRecordClient from "./NewRecordClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function NewRecordPage() {
  const session = await requireRole(["TESTER"], "USE_RECORD_START", "PAGE:/records/new");
  return <NewRecordClient session={session} />;
}
