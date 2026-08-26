import ApprovalsClient from "./ApprovalsClient";

import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function ApprovalsPage() {
  await requireRole(["APPROVER"], "REVIEW_SIGN", "PAGE:/approvals");
  return <ApprovalsClient />;
}
