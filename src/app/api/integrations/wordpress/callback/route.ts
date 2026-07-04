import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  readWordPressState,
  WordPressConnectorService,
} from "@/services/wordpress-connector.service";

export async function GET(req: Request) {
  await db.ready();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("proovra_wp_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      new URL("/dashboard?wordpress=failed", url.origin)
    );
  }

  try {
    const { creatorWallet } = readWordPressState(state);
    await WordPressConnectorService.createConnectionFromCode(
      req,
      creatorWallet,
      code
    );
    await db.flush();

    const response = NextResponse.redirect(
      new URL("/dashboard?wordpress=connected", url.origin)
    );
    response.cookies.delete("proovra_wp_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard?wordpress=failed", url.origin)
    );
  }
}
