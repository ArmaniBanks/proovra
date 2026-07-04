import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type {
  CreatorPlatformConnection,
  CreatorPlatformImportedItem,
} from "@/lib/mock-data";
import { CreatorContentService } from "@/services/creator-content.service";

const WORDPRESS_API_BASE = "https://public-api.wordpress.com/rest/v1.1";
const WORDPRESS_TOKEN_URL = "https://public-api.wordpress.com/oauth2/token";

type WordPressTokenResponse = {
  access_token: string;
  blog_id?: string | number;
  blog_url?: string;
  token_type?: string;
};

type WordPressMeResponse = {
  username?: string;
  display_name?: string;
  email?: string;
};

type WordPressSiteResponse = {
  ID?: string | number;
  name?: string;
  URL?: string;
};

type WordPressPostResponse = {
  ID?: string | number;
  title?: string;
  excerpt?: string;
  content?: string;
  URL?: string;
  date?: string;
};

type WordPressPostsResponse = {
  posts?: WordPressPostResponse[];
};

export type SanitizedWordPressConnection = Omit<
  CreatorPlatformConnection,
  "accessToken"
> & {
  connected: true;
};

function stripHtml(value = "") {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(prefix: string, seed: string) {
  const digest = createHash("sha256")
    .update(`${seed}:${Date.now()}:${Math.random()}`)
    .digest("hex")
    .slice(0, 10);
  return `${prefix}-${digest}`;
}

function getClientId() {
  const value = process.env.WORDPRESS_CLIENT_ID;
  if (!value) throw new Error("WORDPRESS_CLIENT_ID is not configured.");
  return value;
}

function getClientSecret() {
  const value = process.env.WORDPRESS_CLIENT_SECRET;
  if (!value) throw new Error("WORDPRESS_CLIENT_SECRET is not configured.");
  return value;
}

export function getAppBaseUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function getWordPressRedirectUri(req: Request) {
  return `${getAppBaseUrl(req)}/api/integrations/wordpress/callback`;
}

export function createWordPressState(creatorWallet: string) {
  const nonce = randomBytes(16).toString("hex");
  return Buffer.from(JSON.stringify({ creatorWallet, nonce })).toString("base64url");
}

export function readWordPressState(state: string) {
  const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
    creatorWallet?: unknown;
    nonce?: unknown;
  };

  if (typeof parsed.creatorWallet !== "string" || typeof parsed.nonce !== "string") {
    throw new Error("Invalid WordPress OAuth state.");
  }

  return {
    creatorWallet: parsed.creatorWallet,
    nonce: parsed.nonce,
  };
}

async function wordpressFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${WORDPRESS_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`WordPress API failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function exchangeCodeForToken(req: Request, code: string) {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: getWordPressRedirectUri(req),
  });

  const response = await fetch(WORDPRESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`WordPress token exchange failed with HTTP ${response.status}.`);
  }

  const token = (await response.json()) as WordPressTokenResponse;
  if (!token.access_token) throw new Error("WordPress did not return an access token.");
  return token;
}

function sanitizeConnection(
  connection: CreatorPlatformConnection
): SanitizedWordPressConnection {
  const { accessToken, ...safeConnection } = connection;
  void accessToken;
  return { ...safeConnection, connected: true };
}

export class WordPressConnectorService {
  static getAuthorizeUrl(req: Request, creatorWallet: string, state: string) {
    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: getWordPressRedirectUri(req),
      response_type: "code",
      scope: "posts sites",
      state,
    });

    return `https://public-api.wordpress.com/oauth2/authorize?${params.toString()}`;
  }

  static async createConnectionFromCode(
    req: Request,
    creatorWallet: string,
    code: string
  ) {
    const token = await exchangeCodeForToken(req, code);
    const me = await wordpressFetch<WordPressMeResponse>("/me", token.access_token);
    const siteId = token.blog_id ? String(token.blog_id) : undefined;
    const site = siteId
      ? await wordpressFetch<WordPressSiteResponse>(
          `/sites/${encodeURIComponent(siteId)}`,
          token.access_token
        )
      : undefined;
    const posts = siteId
      ? await wordpressFetch<WordPressPostsResponse>(
          `/sites/${encodeURIComponent(siteId)}/posts?number=20&status=publish`,
          token.access_token
        )
      : { posts: [] };

    const importedItems: CreatorPlatformImportedItem[] = (posts.posts ?? [])
      .filter((post) => post.ID && post.title && post.URL)
      .map((post) => ({
        id: String(post.ID),
        title: stripHtml(post.title),
        excerpt: stripHtml(post.excerpt),
        url: post.URL ?? "",
        body: stripHtml(post.content),
        publishedAt: post.date ? new Date(post.date) : undefined,
      }));

    const existing = this.getConnectionForWallet(creatorWallet);
    const now = new Date();
    const connection: CreatorPlatformConnection = {
      id: existing?.id ?? makeId("wp", creatorWallet),
      creatorWallet,
      platform: "wordpress",
      platformAccountName:
        me.display_name ?? me.username ?? me.email ?? "WordPress creator",
      accessToken: token.access_token,
      siteId,
      siteName: site?.name,
      siteUrl: site?.URL ?? token.blog_url,
      importedItems,
      connectedAt: existing?.connectedAt ?? now,
      updatedAt: now,
    };

    db.creatorPlatformConnections.set(connection.id, connection);
    db.addActivity({
      type: "agent_registered",
      agentId: "wordpress-connector",
      description: `${connection.platformAccountName} connected WordPress content to ProoVra.`,
    });
    return sanitizeConnection(connection);
  }

  static getConnectionForWallet(creatorWallet: string) {
    return Array.from(db.creatorPlatformConnections.values()).find(
      (connection) =>
        connection.platform === "wordpress" &&
        connection.creatorWallet.toLowerCase() === creatorWallet.toLowerCase()
    );
  }

  static getSafeConnectionForWallet(creatorWallet: string) {
    const connection = this.getConnectionForWallet(creatorWallet);
    return connection ? sanitizeConnection(connection) : null;
  }

  static monetizeImportedPost(input: {
    creatorWallet: string;
    creatorName: string;
    itemId: string;
    price: number;
  }) {
    const connection = this.getConnectionForWallet(input.creatorWallet);
    if (!connection) throw new Error("WordPress is not connected.");

    const item = connection.importedItems.find(
      (candidate) => candidate.id === input.itemId
    );
    if (!item) throw new Error("Imported WordPress post not found.");

    return CreatorContentService.createContent({
      title: item.title,
      description: item.excerpt || `WordPress post from ${connection.siteName ?? "creator site"}`,
      body: item.body || item.excerpt,
      creatorName: input.creatorName,
      creatorWallet: input.creatorWallet,
      source: "wordpress",
      sourceUrl: item.url,
      price: input.price,
    });
  }
}
