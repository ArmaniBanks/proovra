import type { GitHubPullRequestEvidence, WorkSource } from "@/lib/mock-data";

type GitHubIssueResponse = {
  number: number;
  html_url: string;
  url: string;
  title: string;
  state: "open" | "closed";
  user?: {
    login?: string;
  };
  labels?: Array<string | { name?: string }>;
  updated_at?: string;
  pull_request?: unknown;
  message?: string;
};

type GitHubPullRequestResponse = {
  number: number;
  html_url: string;
  url: string;
  title: string;
  body?: string | null;
  state: "open" | "closed";
  merged: boolean;
  merged_at?: string | null;
  user?: {
    login?: string;
  };
  created_at: string;
  updated_at: string;
  message?: string;
};

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "ProoVra-Settlement-Sidecar",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readGitHubResponse<T extends { message?: string }>(
  response: Response,
  resourceName: string
): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T;
  if (response.ok) return payload;
  if (response.status === 404) {
    throw new Error(`${resourceName} not found or not publicly accessible.`);
  }
  if (response.status === 403) {
    throw new Error("GitHub API rate limit reached. Configure GITHUB_TOKEN and try again.");
  }
  throw new Error(
    payload.message || `${resourceName} lookup failed with HTTP ${response.status}.`
  );
}

export function parseGitHubIssueUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid public GitHub issue URL.");
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    throw new Error("The work source must be a github.com issue URL.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[2] !== "issues" || !/^\d+$/.test(parts[3])) {
    throw new Error("Use a GitHub issue URL in the form github.com/owner/repository/issues/123.");
  }

  return {
    owner: parts[0],
    repository: parts[1],
    issueNumber: Number(parts[3]),
  };
}

export async function getGitHubIssueSource(issueUrl: string): Promise<WorkSource> {
  const { owner, repository, issueNumber } = parseGitHubIssueUrl(issueUrl);
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repository
  )}/issues/${issueNumber}`;
  const response = await fetch(apiUrl, {
    headers: githubHeaders(),
    cache: "no-store",
  });

  const payload = await readGitHubResponse<GitHubIssueResponse>(response, "GitHub issue");
  if (payload.pull_request) {
    throw new Error("Use the originating GitHub issue URL here; submit the pull request as proof.");
  }

  const labels = (payload.labels ?? [])
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => Boolean(label));

  return {
    platform: "github",
    kind: "issue",
    externalId: `${owner}/${repository}#${payload.number}`,
    issueNumber: payload.number,
    url: payload.html_url,
    apiUrl: payload.url,
    repository: `${owner}/${repository}`,
    title: payload.title,
    state: payload.state,
    author: payload.user?.login || "unknown",
    labels,
    importedAt: new Date(),
    updatedAt: payload.updated_at ? new Date(payload.updated_at) : undefined,
  };
}

export function parseGitHubPullRequestUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid public GitHub pull request URL.");
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    throw new Error("The proof URL must be a github.com pull request URL.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[2] !== "pull" || !/^\d+$/.test(parts[3])) {
    throw new Error(
      "Use a GitHub pull request URL in the form github.com/owner/repository/pull/123."
    );
  }

  return {
    owner: parts[0],
    repository: parts[1],
    pullRequestNumber: Number(parts[3]),
  };
}

function referencesIssue(text: string, repository: string, issueNumber: number) {
  const escapedRepository = repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const actionReference = new RegExp(
    `\\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\\s*:?\\s*(?:${escapedRepository})?#${issueNumber}\\b`,
    "i"
  );
  return actionReference.test(text);
}

export async function getGitHubPullRequestEvidence(
  pullRequestUrl: string,
  issueSource: WorkSource
): Promise<GitHubPullRequestEvidence> {
  const parsed = parseGitHubPullRequestUrl(pullRequestUrl);
  const repository = `${parsed.owner}/${parsed.repository}`;
  if (repository.toLowerCase() !== issueSource.repository.toLowerCase()) {
    throw new Error(
      `Pull request repository ${repository} does not match task repository ${issueSource.repository}.`
    );
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    parsed.owner
  )}/${encodeURIComponent(parsed.repository)}/pulls/${parsed.pullRequestNumber}`;
  const response = await fetch(apiUrl, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  const payload = await readGitHubResponse<GitHubPullRequestResponse>(
    response,
    "GitHub pull request"
  );
  const issueNumber =
    issueSource.issueNumber ?? parseGitHubIssueUrl(issueSource.url).issueNumber;
  const referencesImportedIssue = referencesIssue(
    `${payload.title}\n${payload.body || ""}`,
    issueSource.repository,
    issueNumber
  );

  return {
    platform: "github",
    repository,
    pullRequestNumber: payload.number,
    title: payload.title,
    author: payload.user?.login || "unknown",
    state: payload.state,
    merged: payload.merged,
    url: payload.html_url,
    apiUrl: payload.url,
    createdAt: new Date(payload.created_at),
    updatedAt: new Date(payload.updated_at),
    mergedAt: payload.merged_at ? new Date(payload.merged_at) : undefined,
    referencesIssue: referencesImportedIssue,
    referenceWarning: referencesImportedIssue
      ? undefined
      : `This pull request does not declare fixes #${issueNumber}, closes #${issueNumber}, or resolves #${issueNumber}. Requester review is still required.`,
    validatedAt: new Date(),
  };
}
