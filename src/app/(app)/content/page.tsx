"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Copy, ExternalLink, Loader2, Newspaper, Plus, Receipt, Wallet } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type {
  CreatorContent,
  CreatorContentAccess,
  CreatorContentSource,
} from "@/lib/mock-data";
import { cn, formatUSDC, formatTimeAgo } from "@/lib/utils";

type CreatorContentResponse = {
  contents: CreatorContent[];
  accesses: CreatorContentAccess[];
  summary: {
    publishedCount: number;
    totalAccesses: number;
    totalEarned: number;
    activeCreators: number;
  };
};

type ContentForm = {
  title: string;
  description: string;
  body: string;
  creatorName: string;
  creatorWallet: string;
  source: CreatorContentSource;
  sourceUrl: string;
  price: string;
};

const initialForm: ContentForm = {
  title: "Paid research note for AI agents",
  description: "A creator-owned note exposed as an x402 paid JSON endpoint.",
  body:
    "This is creator-owned source material. Agents can read it after paying through ProoVra, then cite the receipt when they reuse the content.",
  creatorName: "ProoVra Creator",
  creatorWallet: "0x1047d233336BE340eFD867dB02C8a466bCFaA357",
  source: "manual",
  sourceUrl: "",
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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedId, setCopiedId] = useState("");

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
          sourceUrl: form.sourceUrl.trim() || undefined,
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

  if (error) {
    return <div className="p-8 text-red-400">Error loading creator content: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
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
          <p className="ml-[42px] text-sm text-zinc-500">
            Turn creator-owned writing, docs, or feeds into x402-paid APIs for agents.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:flex sm:items-center sm:gap-4">
          <Metric label="Published" value={summary?.publishedCount ?? 0} />
          <Metric label="Accesses" value={summary?.totalAccesses ?? 0} />
          <Metric label="Earned" value={formatUSDC(summary?.totalEarned ?? 0)} />
          <Metric label="Creators" value={summary?.activeCreators ?? 0} />
        </div>
      </div>

      <form
        onSubmit={createContent}
        className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Publish Paid Agent Resource
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Start with one explicit creator-owned resource. RSS/Ghost imports can feed this same model.
            </p>
          </div>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
            x402 gated
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

        <div className="mt-3 grid gap-3 lg:grid-cols-[0.7fr_1fr]">
          <select
            value={form.source}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                source: event.target.value as CreatorContentSource,
              }))
            }
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
          >
            <option value="manual">Manual</option>
            <option value="rss">RSS</option>
            <option value="ghost">Ghost</option>
            <option value="docs">Docs</option>
          </select>
          <input
            value={form.sourceUrl}
            onChange={(event) =>
              setForm((current) => ({ ...current, sourceUrl: event.target.value }))
            }
            placeholder="Optional source URL"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
          />
        </div>

        <input
          value={form.creatorWallet}
          onChange={(event) =>
            setForm((current) => ({ ...current, creatorWallet: event.target.value }))
          }
          placeholder="Creator payout wallet"
          className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
        />
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
                      <span>{formatUSDC(content.totalEarned)} earned</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
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
                      {formatUSDC(access.amount)}
                    </span>
                    <span className="text-[11px] text-zinc-600">
                      {formatTimeAgo(access.accessedAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">
                    {access.paymentId}
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
