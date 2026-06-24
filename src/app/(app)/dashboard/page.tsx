"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  Lock,
  ArrowRightLeft,
  CheckCircle2,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { ActivityEvent, Agent, DashboardStats, Settlement } from "@/lib/mock-data";
import { useApi } from "@/hooks/useApi";
import { formatPercent, formatUSDC, formatTimeAgo, cn } from "@/lib/utils";
import { ProoVraMark } from "@/components/brand/proovra-mark";

type DashboardResponse = {
  stats: DashboardStats;
  activities: ActivityEvent[];
  recentSettlements: Settlement[];
  agentsById: Record<string, Agent>;
  dataSource: {
    hasSampleRecords: boolean;
  };
};

// ── Status badge colors ────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
  released: {
    label: "Released",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  verified: {
    label: "Verified",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  funded: {
    label: "Funded",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  submitted: {
    label: "Submitted",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  refunded: {
    label: "Refunded",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  created: {
    label: "Created",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

// ── Activity dot colors ────────────────────────────────────

const activityDotColor: Record<string, string> = {
  funds_released: "bg-emerald-400",
  verification_passed: "bg-emerald-400",
  escrow_funded: "bg-amber-400",
  work_submitted: "bg-blue-400",
  receipt_generated: "bg-amber-400",
  escrow_created: "bg-amber-400",
  reputation_updated: "bg-blue-400",
  verification_failed: "bg-red-400",
  agent_registered: "bg-blue-400",
};

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSeconds = Math.round(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

// ── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { data, loading, error } = useApi<DashboardResponse>("/api/dashboard");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (error) return <div className="p-8 text-red-500">Error loading dashboard: {error.message}</div>;
  if (!data && loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <ProoVraMark size={44} priority />
          <span className="animate-pulse text-xs font-medium uppercase tracking-[0.24em] text-amber-400">
            Loading dashboard
          </span>
        </div>
      </div>

    );
  }

  const recentSettlements = data?.recentSettlements ?? [];
  const dashboardStats = data?.stats;
  const activityList = data?.activities ?? [];
  const agentsById = data?.agentsById ?? {};

  const primaryStats = [
    {
      label: "Total Settled",
      value: formatUSDC(dashboardStats?.totalSettled ?? 0),
      icon: DollarSign,
      accent: "text-amber-400",
      iconBg: "bg-amber-500/10",
      borderAccent: "border-amber-500/20",
    },
    {
      label: "Pending Escrow",
      value: formatUSDC(dashboardStats?.pendingEscrow ?? 0),
      icon: Lock,
      accent: "text-zinc-300",
      iconBg: "bg-zinc-500/10",
      borderAccent: "border-zinc-500/20",
    },
    {
      label: "Settlement Count",
      value: (dashboardStats?.settlementCount ?? 0).toLocaleString(),
      icon: ArrowRightLeft,
      accent: "text-zinc-300",
      iconBg: "bg-zinc-500/10",
      borderAccent: "border-zinc-500/20",
    },
    {
      label: "Success Rate",
      value: formatPercent(dashboardStats?.successRate ?? 0),
      icon: CheckCircle2,
      accent: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      borderAccent: "border-emerald-500/20",
    },
  ];

  const secondaryStats = [
    {
      label: "Active Agents",
      value: (dashboardStats?.activeAgents ?? 0).toString(),
      icon: Users,
    },
    {
      label: "Avg Settlement",
      value: formatDuration(dashboardStats?.avgSettlementTime ?? 0),
      icon: Clock,
    },
    {
      label: "24h Volume",
      value: formatUSDC(dashboardStats?.volume24h ?? 0),
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Settlement network overview from persisted records
        </p>
      </div>

      {/* ── Primary Stats Grid ──────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Settlement Profiles</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Use the same ProoVra settlement engine across open-source bounties,
          creator campaigns, research reviews, audits, and agent tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primaryStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80",
                mounted
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              )}
              style={{
                transitionDelay: mounted ? `${i * 75}ms` : "0ms",
              }}
            >
              {/* subtle top-edge glow */}
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-px",
                  stat.borderAccent
                )}
              />
              <div
                className={cn(
                  "inline-flex items-center justify-center rounded-lg p-2",
                  stat.iconBg
                )}
              >
                <Icon className={cn("h-4 w-4", stat.accent)} />
              </div>
              <p
                className={cn(
                  "mt-3 text-2xl font-semibold tracking-tight font-mono",
                  stat.accent
                )}
              >
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Secondary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {secondaryStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 transition-all duration-300",
                mounted
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0"
              )}
              style={{
                transitionDelay: mounted ? `${300 + i * 75}ms` : "0ms",
              }}
            >
              <div className="inline-flex items-center justify-center rounded-md bg-zinc-800/50 p-2">
                <Icon className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-semibold font-mono text-zinc-200">
                  {stat.value}
                </p>
                <p className="text-[11px] text-zinc-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Two-Column Layout ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left — Recent Settlements ────────────────────────── */}
        <div
          className={cn(
            "lg:col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/60 transition-all duration-500",
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
          style={{ transitionDelay: mounted ? "500ms" : "0ms" }}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              Recent Settlements
            </h2>
            <span className="text-[11px] text-zinc-500 font-mono">
              {recentSettlements.length} shown
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    ID
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Provider
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentSettlements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-zinc-400">No settlements yet</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Register agents, create a task, and fund escrow to populate this table.
                      </p>
                    </td>
                  </tr>
                )}
                {recentSettlements.map((settlement, idx) => {
                  const provider = agentsById[settlement.providerId];
                  const status =
                    statusConfig[settlement.escrowStatus] ?? statusConfig.created;

                  return (
                    <tr
                      key={settlement.id}
                      className={cn(
                        "border-b border-zinc-800/30 transition-colors duration-150 hover:bg-zinc-800/30 cursor-default",
                        mounted
                          ? "translate-y-0 opacity-100"
                          : "translate-y-2 opacity-0"
                      )}
                      style={{
                        transitionDelay: mounted
                          ? `${600 + idx * 50}ms`
                          : "0ms",
                        transitionDuration: "400ms",
                      }}
                    >
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-zinc-400">
                        {settlement.id}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {provider?.avatar ?? "🤖"}
                          </span>
                          <span className="text-xs text-zinc-300">
                            {provider?.name ?? "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-xs text-zinc-200">
                        {formatUSDC(settlement.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-zinc-500">
                        {formatTimeAgo(settlement.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right — Live Activity Feed ───────────────────────── */}
        <div
          className={cn(
            "lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/60 transition-all duration-500",
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
          style={{ transitionDelay: mounted ? "550ms" : "0ms" }}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              Live Activity
            </h2>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div className="divide-y divide-zinc-800/40 px-5">
            {activityList.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-zinc-400">No activity yet</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Product actions will appear here as you register agents and move settlements.
                </p>
              </div>
            )}
            {activityList.map((event, idx) => {
              const agent = agentsById[event.agentId];
              const dotColor = activityDotColor[event.type] ?? "bg-zinc-400";

              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-start gap-3 py-3.5 transition-all duration-400",
                    mounted
                      ? "translate-x-0 opacity-100"
                      : "translate-x-4 opacity-0"
                  )}
                  style={{
                    transitionDelay: mounted
                      ? `${650 + idx * 80}ms`
                      : "0ms",
                    transitionDuration: "400ms",
                  }}
                >
                  {/* colored dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    <div className={cn("h-2 w-2 rounded-full", dotColor)} />
                  </div>

                  {/* content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {event.description}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">
                        {agent?.name ?? "Unknown"}
                      </span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[10px] text-zinc-600">
                        {formatTimeAgo(new Date(event.timestamp))}
                      </span>
                      {event.amount !== undefined && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {formatUSDC(event.amount)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
