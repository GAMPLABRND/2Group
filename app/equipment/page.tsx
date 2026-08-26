import { requirePagePermission } from "@/app/admin/_pageAccess";
import EquipmentConsole from "./EquipmentConsole";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function EquipmentPage() {
  const session = await requirePagePermission(
    "/equipment",
    ["ADMIN", "TESTER", "APPROVER"],
    "EQUIPMENT_VIEW",
  );
  return <EquipmentConsole role={session.role} />;
}
