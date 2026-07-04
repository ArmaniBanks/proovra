import { NextResponse } from "next/server";
import {
  getGitHubIssueSource,
  getGitHubPullRequestEvidence,
} from "@/integrations/github";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      issueUrl?: unknown;
      pullRequestUrl?: unknown;
    };
    if (typeof body.issueUrl !== "string" || !body.issueUrl.trim()) {
      return NextResponse.json({ error: "GitHub issue URL is required." }, { status: 400 });
    }
    if (typeof body.pullRequestUrl !== "string" || !body.pullRequestUrl.trim()) {
      return NextResponse.json(
        { error: "GitHub pull request URL is required." },
        { status: 400 }
      );
    }

    const source = await getGitHubIssueSource(body.issueUrl);
    const pullRequest = await getGitHubPullRequestEvidence(
      body.pullRequestUrl,
      source
    );
    return NextResponse.json({ source, pullRequest });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "GitHub pull request validation failed.",
      },
      { status: 400 }
    );
  }
}
