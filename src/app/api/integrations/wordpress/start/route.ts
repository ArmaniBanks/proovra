import { NextResponse } from "next/server";
import {
  createWordPressState,
  WordPressConnectorService,
} from "@/services/wordpress-connector.service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorWallet = url.searchParams.get("creatorWallet");

  if (!creatorWallet || !/^0x[a-fA-F0-9]{40}$/.test(creatorWallet)) {
    return NextResponse.json(
      { error: "A valid creatorWallet query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const state = createWordPressState(creatorWallet);
    const response = NextResponse.redirect(
      WordPressConnectorService.getAuthorizeUrl(req, creatorWallet, state)
    );
    response.cookies.set("proovra_wp_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(req.url).protocol === "https:",
      maxAge: 10 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "WordPress OAuth could not be started.",
      },
      { status: 500 }
    );
  }
}
