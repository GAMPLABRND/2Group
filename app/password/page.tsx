import { requirePagePermission } from "@/app/admin/_pageAccess";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function PasswordPage() {
  await requirePagePermission(
    "/password",
    ["ADMIN", "TESTER", "APPROVER"],
    "PASSWORD_CHANGE",
    { allowExpiredPassword: true },
  );
  return <PasswordForm />;
}
