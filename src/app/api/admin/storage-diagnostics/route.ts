import { NextResponse } from "next/server";
import { inspectKvDatabaseKeys } from "@/lib/db";

export async function GET(req: Request) {
  const configuredSecret = process.env.PROOVRA_ADMIN_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providedSecret = req.headers.get("x-proovra-admin-secret")?.trim();
  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await inspectKvDatabaseKeys());
}
