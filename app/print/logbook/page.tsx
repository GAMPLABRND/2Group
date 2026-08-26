import LogbookClient from "./LogbookClient";

import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function LogbookPage() {
  await requireRole(["ADMIN", "TESTER", "APPROVER"], "LOGBOOK_PRINT", "PAGE:/print/logbook");
  return <LogbookClient />;
}
