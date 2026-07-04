"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { hasPrivyConfig } from "@/lib/privy-config";
import { formatUSDC } from "@/lib/utils";

type ImportedItem = {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  body: string;
  publishedAt?: string;
};

type WordPressConnection = {
  connected: true;
  id: string;
  creatorWallet: string;
  platform: "wordpress";
  platformAccountName: string;
  siteId?: string;
  siteName?: string;
  siteUrl?: string;
  importedItems: ImportedItem[];
  connectedAt: string;
  updatedAt: string;
};

type WordPressResponse = {
  connection: WordPressConnection | null;
  error?: string;
};

const DEFAULT_PRICE = "0.000001";

export function CreatorPlatformPanel() {
  if (!hasPrivyConfig) {
    return (
      <DisabledPlatformPanel reason="Configure Privy to unlock authenticated WordPress connection." />
    );
  }

  return <PrivyWordPressPanel />;
}

function DisabledPlatformPanel({ reason }: { reason: string }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-zinc-500" />
        <h2 className="text-sm font-semibold text-zinc-100">
          Connect WordPress
        </h2>
      </div>
      <p className="text-sm leading-6 text-zinc-500">{reason}</p>
    </section>
  );
}

function PrivyWordPressPanel() {
  const { authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const wallet =
    wallets.find((candidate) => candidate.walletClientType === "privy") ?? wallets[0];
  const walletAddress = wallet?.address ?? "";
  const creatorName = user?.email?.address ?? "WordPress creator";
  const [connection, setConnection] = useState<WordPressConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [monetizingId, setMonetizingId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadConnection = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/wordpress?creatorWallet=${encodeURIComponent(walletAddress)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as WordPressResponse;
      if (!response.ok) throw new Error(payload.error ?? "WordPress connection failed.");
      setConnection(payload.connection);
    } catch (error) {
      setError(error instanceof Error ? error.message : "WordPress connection failed.");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!authenticated || !walletsReady || !walletAddress) return;
    const frame = window.requestAnimationFrame(() => {
      void loadConnection();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [authenticated, loadConnection, walletAddress, walletsReady]);

  if (!authenticated) {
    return (
      <DisabledPlatformPanel reason="Login with email first. Then connect your own WordPress account through OAuth so ProoVra can import only content you control." />
    );
  }

  if (!walletAddress) {
    return (
      <DisabledPlatformPanel reason="Generating your Privy embedded wallet. WordPress connection unlocks once the creator wallet is ready." />
    );
  }

  function connectWordPress() {
    window.location.href = `/api/integrations/wordpress/start?creatorWallet=${encodeURIComponent(walletAddress)}`;
  }

  async function monetizePost(item: ImportedItem) {
    const price = Number(prices[item.id] ?? DEFAULT_PRICE);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid USDC price before monetizing this post.");
      return;
    }

    setMonetizingId(item.id);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/integrations/wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorWallet: walletAddress,
          creatorName,
          itemId: item.id,
          price,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Post monetization failed.");
      setSuccessMessage(`Published "${item.title}" as x402-paid content.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Post monetization failed.");
    } finally {
      setMonetizingId("");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified platform connector
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Connect your WordPress account
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            ProoVra sends you to WordPress to approve access. After approval, we
            import posts from the authenticated WordPress account only, so creators
            cannot monetize someone else&apos;s content by pasting a URL.
          </p>
        </div>
        <button
          type="button"
          onClick={connectWordPress}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          <Sparkles className="h-4 w-4" />
          {connection ? "Reconnect WordPress" : "Connect WordPress"}
        </button>
      </div>

      {!connection && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">
            Why WordPress first?
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            WordPress.com and Jetpack-connected WordPress sites give us real OAuth,
            real post APIs, and a huge creator/blogger base. This is the simplest
            path to test with your own profile today.
          </p>
          <ol className="mt-4 space-y-2 text-xs leading-5 text-zinc-400">
            <li>1. Create or use your WordPress.com account.</li>
            <li>2. Click Connect WordPress and approve ProoVra.</li>
            <li>3. Return to this dashboard and see your imported posts.</li>
            <li>4. Monetize selected posts as x402-paid agent resources.</li>
          </ol>
        </div>
      )}

      {connection && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  WordPress connected
                </div>
                <p className="text-xs leading-5 text-zinc-400">
                  {connection.platformAccountName}
                  {connection.siteName ? ` · ${connection.siteName}` : ""}
                </p>
                {connection.siteUrl && (
                  <a
                    href={connection.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
                  >
                    Open site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => void loadConnection()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300 disabled:text-zinc-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {loading ? "Refreshing" : "Refresh posts"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-100">
                Imported WordPress posts
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                These posts came from the WordPress account you authenticated.
              </p>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {connection.importedItems.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                  No published WordPress posts were returned for this site.
                </div>
              )}
              {connection.importedItems.map((item) => (
                <div key={item.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_220px]">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                      {item.excerpt || item.body}
                    </p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
                    >
                      Source post
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="space-y-2">
                    <input
                      value={prices[item.id] ?? DEFAULT_PRICE}
                      onChange={(event) =>
                        setPrices((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => void monetizePost(item)}
                      disabled={monetizingId === item.id}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
                    >
                      {monetizingId === item.id
                        ? "Publishing"
                        : `Monetize at ${formatUSDC(Number(prices[item.id] ?? DEFAULT_PRICE))}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {successMessage && (
        <p className="mt-3 text-xs text-emerald-300">{successMessage}</p>
      )}
    </section>
  );
}
