import { NextResponse } from "next/server";
import { getGitHubIssueSource } from "@/integrations/github";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "GitHub issue URL is required." }, { status: 400 });
    }

    const source = await getGitHubIssueSource(body.url);
    return NextResponse.json({
      source,
      suggestedTaskTitle: source.title,
      suggestedProofRequirement:
        "Submit the GitHub pull request URL, commit hash, or merged change that resolves this issue.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GitHub issue import failed." },
      { status: 400 }
    );
  }
}
