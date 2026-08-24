import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

async function logout(req: Request) {
  const session = await getSession();
  await clearSession();
  if (session) {
    await logAudit({
      category: "SECURITY",
      actor: { id: session.userId, role: session.role },
      action: "LOGOUT",
    });
  }
  return NextResponse.redirect(new URL("/login", req.url), 303);
}

export async function POST(req: Request) {
  return logout(req);
}

export async function GET(req: Request) {
  return logout(req);
}
