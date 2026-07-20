"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Lock,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { formatUSDC } from "@/lib/utils";

type DiscoveryResource = {
  id: string;
  title: string;
  excerpt: string;
  creatorName: string;
  source: "manual" | "rss";
  sourceUrl: string | null;
  sourceDomain: string | null;
  pricing: {
    amount: number;
    amountBaseUnits: string;
    currency: "USDC";
    network: string;
    creatorReceives: number;
    platformFee: number;
    platformFeeBps: number;
  };
  access: {
    method: "GET";
    url: string;
    protocol: "x402";
    unpaidStatus: 402;
    paymentHeaders: string[];
  };
  stats: {
    paidAccesses: number;
    totalEarned: number;
    totalGrossVolume: number;
    totalPlatformFees: number;
  };
  updatedAt: string;
};

type DiscoveryResponse = {
  resources: DiscoveryResource[];
  count: number;
};

type AccessState = {
  status: "idle" | "checking" | "payment-required" | "paying" | "authorized" | "error";
  message: string;
  paymentRequirements?: unknown;
  authorizedContent?: {
    title: string;
    body: string;
    creatorName: string;
    sourceUrl: string | null;
  };
  paymentId?: string;
  transaction?: string;
  payTo?: string;
  gatewayDeposit?: {
    amount?: string;
    approvalTxHash?: string;
    depositTxHash?: string;
  } | null;
  splitSettlement?: {
    grossAmount: number;
    creatorNetAmount: number;
    platformFee: number;
    creatorPayment: {
      transaction: string;
      payTo: string;
      fundsStatus: string;
    };
    treasuryPayment: {
      paymentId: string;
      amount: number;
      transaction: string;
      payTo: string;
    };
  } | null;
};

export default function AgentsPage() {
  const [resources, setResources] = useState<DiscoveryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [accessById, setAccessById] = useState<Record<string, AccessState>>({});

  const filteredEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("limit", "25");
    return `/api/agent/discover?${params.toString()}`;
  }, [query]);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(filteredEndpoint, { cache: "no-store" });
      const payload = (await response.json()) as DiscoveryResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Discovery failed.");
      }
      setResources("resources" in payload ? payload.resources : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Discovery failed.");
    } finally {
      setLoading(false);
    }
  }, [filteredEndpoint]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadResources();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadResources]);

  function updateAccess(resourceId: string, state: AccessState) {
    setAccessById((current) => ({ ...current, [resourceId]: state }));
  }

  async function requestAccess(resource: DiscoveryResource) {
    updateAccess(resource.id, {
      status: "checking",
      message: "Agent is requesting gated content without payment...",
    });

    try {
      const response = await fetch(resource.access.url, { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 402) {
        updateAccess(resource.id, {
          status: "payment-required",
          message: "ProoVra returned 402 Payment Required. Agent must pay before reading.",
          paymentRequirements: payload,
        });
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Access request failed.");
      updateAccess(resource.id, {
        status: "authorized",
        message: "Content was already authorized.",
        authorizedContent: payload.content,
        paymentId: payload.paymentId,
      });
    } catch (error) {
      updateAccess(resource.id, {
        status: "error",
        message: error instanceof Error ? error.message : "Access request failed.",
      });
    }
  }

  async function payForAccess(resource: DiscoveryResource) {
    updateAccess(resource.id, {
      status: "paying",
      message: "Agent is submitting a real x402 payment on Arc Testnet...",
    });

    try {
      const response = await fetch("/api/agent/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: resource.id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Payment failed.");
      updateAccess(resource.id, {
        status: "authorized",
        message: payload.agentPayment?.gatewayDeposit
          ? "Gateway auto-deposit completed, x402 payment settled, and ProoVra returned the gated JSON content."
          : "Real x402 payment settled. ProoVra returned the gated JSON content.",
        authorizedContent: payload.content,
        paymentId: payload.paymentId,
        transaction: payload.agentPayment?.transaction,
        payTo: payload.agentPayment?.payTo,
        gatewayDeposit: payload.agentPayment?.gatewayDeposit ?? null,
        splitSettlement: payload.agentPayment?.splitSettlement ?? null,
      });
      void loadResources();
    } catch (error) {
      updateAccess(resource.id, {
        status: "error",
        message: error instanceof Error ? error.message : "Payment failed.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-zinc-900/70 to-zinc-950 p-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <Bot className="h-3.5 w-3.5" />
          Agent buyer console
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Watch agents discover, pay, and unlock creator content.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          This console uses the same discovery and gated access endpoints agents
          use programmatically. The payment button uses Circle Gateway on Arc
          Testnet through the configured agent wallet, then unlocks the gated
          JSON returned by ProoVra.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Discover Paid Resources
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Full content bodies stay hidden until the agent pays.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <Search className="h-4 w-4 text-zinc-600" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, creator, source"
                className="w-64 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </label>
            <button
              type="button"
              onClick={loadResources}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-8 text-center text-sm text-zinc-500">
              Loading paid resources...
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-8 text-center">
              <Lock className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
              <p className="text-sm font-medium text-zinc-400">
                No paid resources found yet
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Monetize RSS or manual content first, then agents can discover it here.
              </p>
            </div>
          ) : (
            resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                state={accessById[resource.id] ?? { status: "idle", message: "" }}
                onRequest={() => requestAccess(resource)}
                onPay={() => payForAccess(resource)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ResourceCard({
  resource,
  state,
  onRequest,
  onPay,
}: {
  resource: DiscoveryResource;
  state: AccessState;
  onRequest: () => void;
  onPay: () => void;
}) {
  const busy = state.status === "checking" || state.status === "paying";

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium uppercase text-amber-300">
              {resource.source}
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400">
              {resource.pricing.network}
            </span>
          </div>
          <h3 className="text-base font-semibold text-zinc-100">{resource.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            {resource.excerpt}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span>Creator: {resource.creatorName}</span>
            {resource.sourceDomain && <span>Source: {resource.sourceDomain}</span>}
            <span>{resource.stats.paidAccesses} paid accesses</span>
          </div>
          <code className="mt-3 block break-all rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-500">
            {resource.access.url}
          </code>
        </div>
        <div className="w-full shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 lg:w-64">
          <p className="text-[11px] uppercase tracking-wider text-zinc-600">
            Price
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-300">
            {formatUSDC(resource.pricing.amount)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">USDC per agent access</p>
          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-xs text-zinc-500">
            <p>Creator receives {formatUSDC(resource.pricing.creatorReceives)}</p>
            <p>ProoVra fee {formatUSDC(resource.pricing.platformFee)}</p>
          </div>
          <div className="mt-4 space-y-2">
            <Link
              href={`/r/${resource.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
            >
              View Resource Page
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={onRequest}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300 disabled:cursor-not-allowed disabled:text-zinc-600"
            >
              <Lock className="h-4 w-4" />
              Request Access
            </button>
            <button
              type="button"
              onClick={onPay}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              <CircleDollarSign className="h-4 w-4" />
              Pay with x402
            </button>
          </div>
        </div>
      </div>

      {state.status !== "idle" && (
        <div
          className={`mt-4 rounded-lg border p-3 ${
            state.status === "authorized"
              ? "border-emerald-500/20 bg-emerald-500/10"
              : state.status === "error"
                ? "border-red-500/20 bg-red-500/10"
                : "border-amber-500/20 bg-amber-500/10"
          }`}
        >
          <div className="flex items-start gap-2">
            {state.status === "authorized" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            ) : (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">{state.message}</p>
              {state.paymentId && (
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                  paymentId: {state.paymentId}
                </p>
              )}
              {state.transaction && (
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                  transaction: {state.transaction}
                </p>
              )}
              {state.payTo && (
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                  creator payTo: {state.payTo}
                </p>
              )}
              {state.gatewayDeposit?.depositTxHash && (
                <div className="mt-2 space-y-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-zinc-400">
                  <p>
                    Gateway auto-deposit: {state.gatewayDeposit.amount ?? "0.5"} USDC
                  </p>
                  {state.gatewayDeposit.approvalTxHash && (
                    <p className="break-all font-mono">
                      approval: {state.gatewayDeposit.approvalTxHash}
                    </p>
                  )}
                  <p className="break-all font-mono">
                    deposit: {state.gatewayDeposit.depositTxHash}
                  </p>
                </div>
              )}
              {state.splitSettlement && (
                <div className="mt-2 space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-zinc-400">
                  <p>
                    Split settlement: creator net{" "}
                    {formatUSDC(state.splitSettlement.creatorNetAmount)} + treasury fee{" "}
                    {formatUSDC(state.splitSettlement.platformFee)}
                  </p>
                  <p className="break-all font-mono">
                    creator tx: {state.splitSettlement.creatorPayment.transaction}
                  </p>
                  <p className="break-all font-mono">
                    treasury tx: {state.splitSettlement.treasuryPayment.transaction}
                  </p>
                </div>
              )}
              {state.paymentRequirements ? (
                <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-xs leading-5 text-zinc-400">
                  {JSON.stringify(state.paymentRequirements, null, 2)}
                </pre>
              ) : null}
              {state.authorizedContent ? (
                <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-100">
                      {state.authorizedContent.title}
                    </p>
                    {state.authorizedContent.sourceUrl && (
                      <a
                        href={state.authorizedContent.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
                      >
                        Source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                    {state.authorizedContent.body}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
