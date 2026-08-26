import { requireRole } from "@/lib/auth";
import RecordDetailClient from "./RecordDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function RecordDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  await requireRole(["ADMIN", "TESTER", "APPROVER"], "USE_RECORD_VIEW", "PAGE:/records/detail");
  const { recordId } = await params;
  return <RecordDetailClient recordId={recordId} />;
}
