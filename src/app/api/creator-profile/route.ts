import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CreatorProfileService } from "@/services/creator-profile.service";
import type { CreatorProfile } from "@/lib/mock-data";

export const runtime = "nodejs";

type CreatorProfileBody = {
  creatorWallet?: unknown;
  email?: unknown;
  displayName?: unknown;
  username?: unknown;
};

function publicProfile(profile: CreatorProfile | null | undefined) {
  if (!profile) return null;
  return {
    id: profile.id,
    creatorWallet: profile.creatorWallet,
    displayName: profile.displayName,
    username: profile.username,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function GET(req: Request) {
  await db.ready();
  const wallet = new URL(req.url).searchParams.get("creatorWallet");
  if (!wallet) {
    return NextResponse.json(
      { error: "creatorWallet query parameter is required." },
      { status: 400 }
    );
  }
  return NextResponse.json({
    profile: publicProfile(CreatorProfileService.getProfile(wallet)),
  });
}

export async function POST(req: Request) {
  await db.ready();
  const body = (await req.json()) as CreatorProfileBody;
  if (
    typeof body.creatorWallet !== "string" ||
    typeof body.displayName !== "string" ||
    typeof body.username !== "string"
  ) {
    return NextResponse.json(
      { error: "creatorWallet, displayName, and username are required." },
      { status: 400 }
    );
  }

  try {
    const profile = CreatorProfileService.saveProfile({
      creatorWallet: body.creatorWallet,
      email: typeof body.email === "string" ? body.email : undefined,
      displayName: body.displayName,
      username: body.username,
    });
    await db.flush();
    return NextResponse.json({ profile: publicProfile(profile) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile update failed." },
      { status: 400 }
    );
  }
}
