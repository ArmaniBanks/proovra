"use client";

import {
  Bot,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileText,
  History,
  Newspaper,
  RefreshCw,
  Users,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatUSDC } from "@/lib/utils";

type ActivityEvent = {
  id: string;
  type: "content_published" | "agent_paid_access";
  title: string;
  description: string;
  creatorName: string;
  source: "manual" | "rss";
  sourceUrl: string | null;
  sourceDomain: string | null;
  price: number;
  amount: number | null;
  currency: "USDC";
  paidAccesses: number;
  totalEarned: number;
  agentWallet: string | null;
  contentId: string;
  occurredAt: string;
};

type ActivityResponse = {
  events: ActivityEvent[];
  summary: {
    publishedCount: number;
    paidAccessCount: number;
    totalEarned: number;
    activeCreators: number;
  };
};

export default function ActivityPage() {
  const { data, loading, error, mutate } =
    useApi<ActivityResponse>("/api/activity");

  const events = data?.events ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <History className="h-3.5 w-3.5" />
            Global activity
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            ProoVra Activity
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            A public timeline of creator resources published on ProoVra and
            agent-paid x402 accesses. Content bodies stay hidden until payment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Newspaper}
          label="Published"
          value={loading ? "..." : summary?.publishedCount ?? 0}
        />
        <Metric
          icon={Bot}
          label="Agent Payments"
          value={loading ? "..." : summary?.paidAccessCount ?? 0}
        />
        <Metric
          icon={CircleDollarSign}
          label="Creator Earned"
          value={loading ? "..." : formatUSDC(summary?.totalEarned ?? 0)}
        />
        <Metric
          icon={Users}
          label="Creators"
          value={loading ? "..." : summary?.activeCreators ?? 0}
        />
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">All History</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Newest publish and paid-access events appear first.
          </p>
        </div>

        {error && (
          <div className="px-5 py-6 text-sm text-red-400">
            Activity feed unavailable: {error.message}
          </div>
        )}

        {!error && loading && events.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-zinc-500">
            Loading activity...
          </div>
        )}

        {!error && !loading && events.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Clock3 className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">
              No ProoVra activity yet
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Published resources and agent payments will show here.
            </p>
          </div>
        )}

        {events.length > 0 && (
          <div className="divide-y divide-zinc-800/70">
            {events.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const paid = event.type === "agent_paid_access";
  const Icon = paid ? Bot : FileText;

  return (
    <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${
              paid
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/20 bg-amber-500/10 text-amber-300"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {paid ? "Agent paid" : "Published"}
          </span>
          <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] uppercase tracking-wider text-zinc-500">
            {event.source}
          </span>
          {event.sourceDomain && (
            <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] text-zinc-500">
              {event.sourceDomain}
            </span>
          )}
        </div>
        <h3 className="truncate text-base font-semibold text-zinc-100">
          {event.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">
          {event.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
          <span>Creator: {event.creatorName}</span>
          {event.agentWallet && <span>Agent: {event.agentWallet}</span>}
          <span>{formatDate(event.occurredAt)}</span>
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200"
            >
              Source
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <div className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-right sm:grid-cols-3 lg:min-w-[320px]">
        <MiniStat label="Price" value={formatUSDC(event.price)} />
        <MiniStat
          label={paid ? "Paid" : "Accesses"}
          value={paid ? formatUSDC(event.amount ?? 0) : event.paidAccesses}
        />
        <MiniStat label="Earned" value={formatUSDC(event.totalEarned)} />
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Newspaper;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 inline-flex rounded-lg bg-amber-500/10 p-2">
        <Icon className="h-4 w-4 text-amber-400" />
      </div>
      <p className="font-mono text-2xl font-semibold tracking-tight text-zinc-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-zinc-100">
        {value}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
