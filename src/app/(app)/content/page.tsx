"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Newspaper,
  Plus,
  Receipt,
  Rss,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useApi } from "@/hooks/useApi";
import type {
  CreatorContent,
  CreatorContentAccess,
} from "@/lib/mock-data";
import { cn, formatUSDC, formatTimeAgo } from "@/lib/utils";
import { hasPrivyConfig } from "@/lib/privy-config";

type CreatorContentResponse = {
  contents: CreatorContent[];
  accesses: CreatorContentAccess[];
  summary: {
    publishedCount: number;
    totalAccesses: number;
    totalEarned: number;
    totalGrossVolume: number;
    totalPlatformFees: number;
    activeCreators: number;
    revenue: {
      platformFeePercent: number;
      treasuryConfigured: boolean;
    };
  };
};

type ContentForm = {
  title: string;
  description: string;
  body: string;
  creatorName: string;
  creatorWallet: string;
  price: string;
};

type RssFeedItem = {
  id: string;
  title: string;
  link: string;
  publishedAt?: string;
  excerpt: string;
  body: string;
};

type RssVerification = {
  id: string;
  creatorWallet: string;
  feedUrl: string;
  domain: string;
  verificationCode: string;
  status: "pending" | "verified";
  verifiedAt?: string;
};

type RssPrepareResponse = {
  feed?: {
    feedUrl: string;
    domain: string;
    title: string;
    items: RssFeedItem[];
  };
  verification?: RssVerification;
  error?: string;
};

const initialForm: ContentForm = {
  title: "Paid research note for AI agents",
  description: "A creator-owned note exposed as an x402 paid JSON endpoint.",
  body:
    "This is creator-owned source material. Agents can read it after paying through ProoVra, then cite the receipt when they reuse the content.",
  creatorName: "ProoVra Creator",
  creatorWallet: "",
  price: "0.000001",
};

function accessUrl(contentId: string) {
  if (typeof window === "undefined") return `/api/creator-content/${contentId}/access`;
  return `${window.location.origin}/api/creator-content/${contentId}/access`;
}

export default function CreatorContentPage() {
  const { data, loading, error, mutate } =
    useApi<CreatorContentResponse>("/api/creator-content");
  const [form, setForm] = useState<ContentForm>(initialForm);
  const [privyWalletAddress, setPrivyWalletAddress] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [rssFeedUrl, setRssFeedUrl] = useState("");
  const [rssVerificationUrl, setRssVerificationUrl] = useState("");
  const [rssFeed, setRssFeed] = useState<RssPrepareResponse["feed"] | null>(null);
  const [rssVerification, setRssVerification] =
    useState<RssVerification | null>(null);
  const [rssSelectedItemId, setRssSelectedItemId] = useState("");
  const [rssPrice, setRssPrice] = useState("0.000001");
  const [rssPayoutWallet, setRssPayoutWallet] = useState("");
  const [rssAction, setRssAction] = useState<
    "idle" | "preparing" | "verifying" | "monetizing"
  >("idle");
  const [rssError, setRssError] = useState("");
  const [rssSuccess, setRssSuccess] = useState("");
  const syncCreatorIdentity = useCallback(
    (identity: { email: string; walletAddress: string }) => {
      setCreatorEmail(identity.email);
      setPrivyWalletAddress(identity.walletAddress);
      setRssPayoutWallet((current) => current || identity.walletAddress);
      setForm((current) => ({
        ...current,
        creatorName: current.creatorName || initialForm.creatorName,
        creatorWallet: identity.walletAddress || current.creatorWallet,
      }));
    },
    []
  );

  useEffect(() => {
    if (!privyWalletAddress) return;
    let active = true;
    async function loadProfile() {
      try {
        const response = await fetch(
          `/api/creator-profile?creatorWallet=${encodeURIComponent(privyWalletAddress)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          profile?: { displayName?: string } | null;
        };
        const displayName = payload.profile?.displayName;
        if (!active || !displayName) return;
        setForm((current) => ({
          ...current,
          creatorName:
            current.creatorName === initialForm.creatorName ||
            current.creatorName === creatorEmail
              ? displayName
              : current.creatorName,
        }));
      } catch {
        // Profile names are helpful, but publishing should remain usable.
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [creatorEmail, privyWalletAddress]);

  const contents = data?.contents ?? [];
  const accesses = data?.accesses ?? [];
  const summary = data?.summary;
  const canSubmit = useMemo(
    () =>
      form.title.trim() &&
      form.description.trim() &&
      form.body.trim() &&
      form.creatorName.trim() &&
      form.creatorWallet.trim() &&
      Number(form.price) > 0,
    [form]
  );

  async function createContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/creator-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: "manual",
          price: Number(form.price),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Content creation failed");
      setForm((current) => ({
        ...initialForm,
        creatorName: current.creatorName,
        creatorWallet: current.creatorWallet,
      }));
      void mutate(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Content creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyEndpoint(contentId: string) {
    await navigator.clipboard.writeText(accessUrl(contentId));
    setCopiedId(contentId);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  async function prepareRssImport() {
    if (!rssFeedUrl.trim() || !form.creatorWallet.trim()) return;
    setRssAction("preparing");
    setRssError("");
    setRssSuccess("");
    try {
      const response = await fetch("/api/integrations/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          creatorWallet: form.creatorWallet,
          feedUrl: rssFeedUrl,
        }),
      });
      const payload = (await response.json()) as RssPrepareResponse;
      if (!response.ok) throw new Error(payload.error ?? "RSS import failed");
      setRssFeed(payload.feed ?? null);
      setRssVerification(payload.verification ?? null);
      setRssSelectedItemId(payload.feed?.items[0]?.id ?? "");
      setRssPayoutWallet(form.creatorWallet);
    } catch (error) {
      setRssError(error instanceof Error ? error.message : "RSS import failed");
    } finally {
      setRssAction("idle");
    }
  }

  async function verifyRssOwnership() {
    if (!rssFeedUrl.trim() || !form.creatorWallet.trim()) return;
    setRssAction("verifying");
    setRssError("");
    setRssSuccess("");
    try {
      const response = await fetch("/api/integrations/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          creatorWallet: form.creatorWallet,
          feedUrl: rssFeedUrl,
          verificationUrl: rssVerificationUrl.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        verification?: RssVerification;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "RSS verification failed");
      setRssVerification(payload.verification ?? null);
      setRssSuccess("RSS ownership verified. You can now monetize selected feed items.");
    } catch (error) {
      setRssError(
        error instanceof Error ? error.message : "RSS verification failed"
      );
    } finally {
      setRssAction("idle");
    }
  }

  async function monetizeRssItem() {
    if (!rssFeed || !rssSelectedItemId || !rssPayoutWallet.trim()) return;
    setRssAction("monetizing");
    setRssError("");
    setRssSuccess("");
    try {
      const response = await fetch("/api/integrations/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "monetize",
          creatorWallet: form.creatorWallet,
          creatorName: form.creatorName,
          feedUrl: rssFeed.feedUrl,
          itemId: rssSelectedItemId,
          price: Number(rssPrice),
          payoutWallet: rssPayoutWallet,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "RSS monetization failed");
      setRssSuccess("RSS item published as x402-gated creator content.");
      void mutate(true);
    } catch (error) {
      setRssError(
        error instanceof Error ? error.message : "RSS monetization failed"
      );
    } finally {
      setRssAction("idle");
    }
  }

  if (error) {
    return <div className="p-8 text-red-400">Error loading creator content: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      {hasPrivyConfig && (
        <CreatorWalletSync onCreatorIdentity={syncCreatorIdentity} />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Newspaper className="h-4 w-4 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Creator Content
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500 sm:ml-[42px]">
            Turn creator-owned writing, docs, or feeds into x402-paid APIs for agents.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-left sm:flex sm:items-center sm:gap-4 sm:text-right">
          <Metric label="Published" value={summary?.publishedCount ?? 0} />
          <Metric label="Accesses" value={summary?.totalAccesses ?? 0} />
          <Metric label="Creator Net" value={formatUSDC(summary?.totalEarned ?? 0)} />
          <Metric label="ProoVra Fees" value={formatUSDC(summary?.totalPlatformFees ?? 0)} />
        </div>
      </div>

      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-300">
              <Rss className="h-3.5 w-3.5" />
              Verified RSS import
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Import public RSS content you control
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
              Works with public RSS feeds from creator-owned sites and publishing
              platforms. ProoVra fetches recent public items,
              then requires a verification code on the feed/domain before any
              item can be monetized.
            </p>
          </div>
          {rssVerification && (
            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                rssVerification.status === "verified"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-300"
              }`}
            >
              {rssVerification.status === "verified"
                ? "Feed verified"
                : "Verification pending"}
            </span>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={rssFeedUrl}
            onChange={(event) => {
              setRssFeedUrl(event.target.value);
              setRssFeed(null);
              setRssVerification(null);
              setRssSelectedItemId("");
              setRssError("");
              setRssSuccess("");
            }}
            placeholder="https://creator.example.com/rss.xml"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <button
            type="button"
            onClick={prepareRssImport}
            disabled={
              !rssFeedUrl.trim() ||
              !form.creatorWallet.trim() ||
              rssAction === "preparing"
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 lg:w-auto"
          >
            {rssAction === "preparing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {rssAction === "preparing" ? "Fetching" : "Fetch feed"}
          </button>
        </div>
        {!form.creatorWallet.trim() && (
          <p className="mt-2 text-xs text-zinc-500">
            Connect/login first so the verified feed is tied to your creator wallet.
          </p>
        )}

        {rssVerification && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Prove ownership of {rssVerification.domain}
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Add this code to a new RSS item, your site homepage/meta tag,
                  or a public page on the same domain. ProoVra must find it
                  before monetization is enabled. If the code is already inside
                  a post that appears in this feed, you can leave the page URL
                  blank and verify from the feed.
                </p>
                {rssVerification.domain.includes("medium.com") && (
                  <p className="mt-2 text-xs leading-5 text-amber-300">
                    Medium tip: publish a short public Medium story containing
                    this code, fetch the feed again, then verify. Your Medium bio
                    is not part of the RSS feed, and Medium may block homepage
                    checks, so a public story is the most reliable proof.
                  </p>
                )}
              </div>
            </div>
            <code className="block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-amber-300">
              {rssVerification.verificationCode}
            </code>
            <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto]">
              <input
                value={rssVerificationUrl}
                onChange={(event) => setRssVerificationUrl(event.target.value)}
                placeholder="Optional public verification page URL on same domain"
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
              />
              <button
                type="button"
                onClick={verifyRssOwnership}
                disabled={rssAction === "verifying"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
              >
                {rssAction === "verifying" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Verify ownership
              </button>
            </div>
          </div>
        )}

        {rssFeed && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-100">
                Recent items from {rssFeed.title}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Only public items from the verified feed/domain can be monetized.
              </p>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {rssFeed.items.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                  No public same-domain items were found in this feed.
                </div>
              )}
              {rssFeed.items.map((item) => {
                const selected = item.id === rssSelectedItemId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRssSelectedItemId(item.id)}
                    className={`block w-full px-4 py-4 text-left transition-colors ${
                      selected ? "bg-amber-500/10" : "hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                          {item.excerpt || item.body}
                        </p>
                        <span className="mt-2 inline-flex text-xs text-amber-300">
                          {item.link}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-zinc-600">
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleDateString()
                          : "No date"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {rssFeed && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[0.5fr_1fr_auto]">
            <input
              value={rssPrice}
              onChange={(event) => setRssPrice(event.target.value)}
              inputMode="decimal"
              placeholder="0.000001"
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <input
              value={rssPayoutWallet}
              onChange={(event) => setRssPayoutWallet(event.target.value)}
              readOnly={Boolean(privyWalletAddress)}
              placeholder="Payout wallet"
              className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={monetizeRssItem}
              disabled={
                !rssSelectedItemId ||
                rssVerification?.status !== "verified" ||
                rssAction === "monetizing"
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 lg:w-auto"
            >
              {rssAction === "monetizing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Monetize selected RSS item
            </button>
          </div>
        )}

        {rssError && <p className="mt-3 text-xs text-red-400">{rssError}</p>}
        {rssSuccess && (
          <p className="mt-3 text-xs text-emerald-300">{rssSuccess}</p>
        )}
      </section>

      <form
        onSubmit={createContent}
        className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5"
      >
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Publish Paid Agent Resource
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Start with one explicit creator-owned resource. RSS/Ghost imports can feed this same model.
            </p>
          </div>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
            {summary?.revenue.platformFeePercent ?? 10}% platform fee
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr_0.7fr]">
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Content title"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <input
            value={form.creatorName}
            onChange={(event) =>
              setForm((current) => ({ ...current, creatorName: event.target.value }))
            }
            placeholder="Creator name"
            aria-label="Public creator display name"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <input
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            inputMode="decimal"
            placeholder="0.000001"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
          />
        </div>

        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
          <p className="text-xs leading-5 text-zinc-500">
            Manual content is for content written directly inside ProoVra. Use
            the verified RSS importer above for feed/platform content.
          </p>
        </div>

        <input
          value={form.creatorWallet}
          onChange={(event) =>
            setForm((current) => ({ ...current, creatorWallet: event.target.value }))
          }
          placeholder="Creator payout wallet"
          readOnly={Boolean(privyWalletAddress)}
          className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
        />
        {privyWalletAddress && (
          <p className="mt-2 text-xs text-emerald-300">
            Payout wallet is your embedded wallet on Arc Testnet.
          </p>
        )}
        <input
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          placeholder="Short description for agents"
          className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
        />
        <textarea
          value={form.body}
          onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
          rows={5}
          placeholder="Content returned after payment"
          className="mt-3 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            Agents receive `402 Payment Required`, pay on Arc, then get this content as JSON.
          </p>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? "Publishing" : "Publish"}
          </button>
        </div>
        {formError && <p className="mt-3 text-xs text-red-400">{formError}</p>}
      </form>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-3">
          {loading && contents.length === 0 ? (
            <EmptyState text="Loading creator resources" />
          ) : contents.length === 0 ? (
            <EmptyState text="No paid creator resources yet" />
          ) : (
            contents.map((content) => (
              <div
                key={content.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                        {content.status}
                      </span>
                      <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 text-[11px] text-zinc-400">
                        {content.source.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-100">{content.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{content.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5" />
                        {content.creatorName}
                      </span>
                      <span>{formatUSDC(content.price)} per access</span>
                      <span>{content.accessCount} paid accesses</span>
                      <span>{formatUSDC(content.totalEarned)} creator net</span>
                      <span>
                        {formatUSDC(content.totalPlatformFees ?? 0)} ProoVra fees
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <a
                      href={`/r/${content.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
                    >
                      Share Page
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => copyEndpoint(content.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedId === content.id ? "Copied" : "Copy API"}
                    </button>
                    <a
                      href={`/api/creator-content/${content.id}/access`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                    >
                      Test 402
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <code className="mt-4 block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-500">
                  GET {accessUrl(content.id)}
                </code>
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Access Receipts</h2>
            <Receipt className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="divide-y divide-zinc-800/50 px-5">
            {accesses.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                Paid agent accesses will appear here.
              </div>
            ) : (
              accesses.map((access) => (
                <div key={access.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-zinc-400">
                      {formatUSDC(access.amount)} gross
                    </span>
                    <span className="text-[11px] text-zinc-600">
                      {formatTimeAgo(access.accessedAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">
                    {access.paymentId}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Creator net {formatUSDC(access.creatorNetAmount ?? access.amount)}
                    {" · "}
                    ProoVra fee {formatUSDC(access.platformFee ?? 0)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatorWalletSync({
  onCreatorIdentity,
}: {
  onCreatorIdentity: (identity: { email: string; walletAddress: string }) => void;
}) {
  const { authenticated, user } = usePrivy();
  const { wallets, ready } = useWallets();

  useEffect(() => {
    if (!authenticated || !ready) return;
    const wallet =
      wallets.find((candidate) => candidate.walletClientType === "privy") ?? wallets[0];
    if (!wallet?.address) return;
    onCreatorIdentity({
      email: user?.email?.address ?? "",
      walletAddress: wallet.address,
    });
  }, [authenticated, onCreatorIdentity, ready, user?.email?.address, wallets]);

  return null;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-sm font-semibold text-zinc-200">{value}</p>
      <p className="text-[11px] text-zinc-600">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/30 py-16 text-center")}>
      <Newspaper className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
      <p className="text-sm font-medium text-zinc-400">{text}</p>
    </div>
  );
}
