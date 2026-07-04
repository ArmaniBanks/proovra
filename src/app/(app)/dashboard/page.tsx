"use client";

import Link from "next/link";
import { ArrowRight, Bot, CircleDollarSign, Newspaper, Receipt, Zap } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { CreatorContent, CreatorContentAccess } from "@/lib/mock-data";
import { formatUSDC } from "@/lib/utils";
import { ProoVraMark } from "@/components/brand/proovra-mark";

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

export default function DashboardPage() {
  const { data, loading, error } =
    useApi<CreatorContentResponse>("/api/creator-content");

  if (error) {
    return <div className="p-8 text-red-400">Error loading dashboard: {error.message}</div>;
  }

  const summary = data?.summary;
  const contents = data?.contents ?? [];
  const latestContent = contents[0];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/10 via-zinc-900/60 to-zinc-950 p-6">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <ProoVraMark size={18} />
          Creator-owned content, paid agent access
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white">
              ProoVra turns creator content into x402-paid APIs for AI agents.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
              Creators publish content they own, set a USDC nanoprice, and agents
              receive a `402 Payment Required` challenge before reading, citing, or
              reusing the content.
            </p>
          </div>
          <Link
            href="/content"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            Publish Content
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Newspaper}
          label="Published Resources"
          value={loading ? "..." : summary?.publishedCount ?? 0}
        />
        <StatCard
          icon={Bot}
          label="Paid Agent Accesses"
          value={loading ? "..." : summary?.totalAccesses ?? 0}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Creator Earnings"
          value={loading ? "..." : formatUSDC(summary?.totalEarned ?? 0)}
        />
        <StatCard
          icon={Receipt}
          label="Active Creators"
          value={loading ? "..." : summary?.activeCreators ?? 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Agent Payment Flow</h2>
          </div>
          <div className="space-y-3 text-sm text-zinc-400">
            <FlowStep label="1" text="Agent requests a creator content endpoint." />
            <FlowStep label="2" text="ProoVra returns x402 payment requirements." />
            <FlowStep label="3" text="Agent pays USDC on Arc through Circle x402." />
            <FlowStep label="4" text="ProoVra returns clean JSON content plus a receipt." />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Latest Resource</h2>
            <Link href="/content" className="text-xs text-amber-400 hover:text-amber-300">
              View all
            </Link>
          </div>
          {latestContent ? (
            <div>
              <p className="text-base font-semibold text-zinc-100">{latestContent.title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {latestContent.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-zinc-400">
                  {latestContent.source.toUpperCase()}
                </span>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-300">
                  {formatUSDC(latestContent.price)} per access
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                  {latestContent.accessCount} paid accesses
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Newspaper className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
              <p className="text-sm font-medium text-zinc-400">
                No creator resources yet
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Publish the first paid resource from the Creator Content page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
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

function FlowStep({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 font-mono text-xs text-amber-300">
        {label}
      </span>
      <p className="leading-6">{text}</p>
    </div>
  );
}
