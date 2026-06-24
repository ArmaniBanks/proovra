"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useConnectedWallet } from "@/hooks/useConnectedWallet";
import type { Agent, AgentRole, AgentType } from "@/lib/mock-data";
import {
  clampPercent,
  formatPercent,
  formatReputationScore,
  formatUSDC,
  cn,
} from "@/lib/utils";
import {
  Users,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Activity,
  Shield,
  Plus,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────

type FilterTab = "all" | "provider" | "requester";

function reputationColor(score: number) {
  if (score >= 95) return "text-emerald-400";
  if (score >= 90) return "text-amber-400";
  return "text-red-400";
}

function reputationBarColor(score: number) {
  if (score >= 95) return "bg-emerald-500";
  if (score >= 90) return "bg-amber-500";
  return "bg-red-500";
}

function typeBadge(type: Agent["type"]) {
  const map = {
    provider: {
      label: "Provider",
      cls: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
    },
    requester: {
      label: "Requester",
      cls: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
    },
    both: {
      label: "Both",
      cls: "bg-purple-500/15 text-purple-400 ring-purple-500/20",
    },
  };
  return map[type];
}

const roleOptions: { value: AgentRole; label: string }[] = [
  { value: "orchestrator", label: "Orchestrator" },
  { value: "developer", label: "Developer" },
  { value: "research", label: "Researcher" },
  { value: "writer", label: "Writer" },
  { value: "editor", label: "Editor" },
  { value: "designer", label: "Designer" },
  { value: "qa-tester", label: "QA Tester" },
  { value: "publisher", label: "Content Creator" },
  { value: "data", label: "Data Analyst" },
  { value: "voice", label: "Voice Specialist" },
  { value: "community-moderator", label: "Community Moderator" },
  { value: "security", label: "Security" },
  { value: "agent-operator", label: "Agent Operator" },
];

const roleLabels = Object.fromEntries(
  roleOptions.map((role) => [role.value, role.label])
) as Record<AgentRole, string>;

// ── Page ───────────────────────────────────────────────────

export default function AgentsPage() {
  const router = useRouter();
  const { data, loading, error, mutate } = useApi<{
    agents: Agent[];
    dataSource: {
      hasSampleRecords: boolean;
    };
  }>("/api/agents");
  const walletAddress = useConnectedWallet();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [agentForm, setAgentForm] = useState<{
    name: string;
    role: AgentRole;
    type: AgentType;
    description: string;
    walletAddress: string;
  }>({
    name: "",
    role: "orchestrator",
    type: "requester",
    description: "",
    walletAddress: "",
  });
  const agents = data?.agents ?? [];

  if (error) return <div className="p-8 text-red-500 border border-red-500/20 bg-red-500/10 rounded-md m-4">Error loading data: {error.message}</div>;
  if (!data && loading) return <div className="animate-pulse p-8 text-zinc-500">Loading...</div>;

  const visibleAgents = agents.filter((agent) => {
    const hasStandaloneActivity =
      agent.completedSettlements > 0 ||
      agent.totalEarnings > 0 ||
      agent.successRate > 0 ||
      agent.reputationScore > 0 ||
      agent.activeEscrows > 0;

    if (agent.type === "requester") {
      return hasStandaloneActivity;
    }

    return true;
  });

  const filteredAgents = visibleAgents.filter((agent) => {
    if (activeTab === "all") return true;
    if (activeTab === "provider")
      return agent.type === "provider" || agent.type === "both";
    if (activeTab === "requester")
      return agent.type === "requester" || agent.type === "both";
    return true;
  });

  // Network totals
  const totalSettlements = visibleAgents.reduce(
    (s, a) => s + a.completedSettlements,
    0
  );
  const totalVolume = visibleAgents.reduce(
    (s, a) => s + a.totalEarnings + a.totalSpending,
    0
  );
  const totalActiveEscrows = visibleAgents.reduce(
    (s, a) => s + a.activeEscrows,
    0
  );

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "provider", label: "Providers" },
    { key: "requester", label: "Requesters" },
  ];

  const canRegister = Boolean(
    walletAddress && agentForm.name.trim() && agentForm.description.trim()
  );

  async function registerAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRegister) return;

    setSubmitting(true);
    setFormError("");

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...agentForm,
          walletAddress: agentForm.walletAddress.trim() || walletAddress,
          avatar: agentForm.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as { error?: string };
        throw new Error(payload.error ?? "Agent registration failed");
      }

      setAgentForm({
        name: "",
        role: "orchestrator",
        type: "requester",
        description: "",
        walletAddress: "",
      });
      router.push("/tasks?focus=create-task");
      void mutate(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Agent registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Agent Registry
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Register professional service agents for proof-based task settlement.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur">
          <Users className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-mono">{visibleAgents.length}</span>
          <span className="text-zinc-500">Agents</span>
        </div>
      </div>

      <form
        onSubmit={registerAgent}
        className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Register Agent</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Create requester or provider agents that participate in proof-based settlements.
            </p>
          </div>
          {!walletAddress && (
            <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-500">
              Connect wallet to register
            </span>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.4fr]">
          <input
            value={agentForm.name}
            onChange={(event) => setAgentForm((form) => ({ ...form, name: event.target.value }))}
            placeholder="Agent name"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <select
            value={agentForm.type}
            onChange={(event) =>
              setAgentForm((form) => ({ ...form, type: event.target.value as AgentType }))
            }
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500/50"
          >
            <option value="requester">Requester</option>
            <option value="provider">Provider</option>
            <option value="both">Both</option>
          </select>
          <select
            value={agentForm.role}
            onChange={(event) =>
              setAgentForm((form) => ({ ...form, role: event.target.value as AgentRole }))
            }
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500/50"
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <input
            value={agentForm.description}
            onChange={(event) =>
              setAgentForm((form) => ({ ...form, description: event.target.value }))
            }
            placeholder="Proof or service role"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
          />
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={agentForm.walletAddress}
            onChange={(event) =>
              setAgentForm((form) => ({ ...form, walletAddress: event.target.value }))
            }
            placeholder={walletAddress || "Wallet address from connected wallet"}
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <button
            type="submit"
            disabled={!canRegister || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
          >
            <Plus className="h-4 w-4" />
            {submitting ? "Registering" : "Register Agent"}
          </button>
        </div>
        {formError && <p className="mt-3 text-xs text-red-400">{formError}</p>}
      </form>

      {/* ── Filter Bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-zinc-800/60">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-amber-500" />
            )}
          </button>
        ))}
      </div>

      {/* ── Agent Cards Grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredAgents.length > 0 ? (
          filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center lg:col-span-2">
            <Users className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No agents registered yet</p>
            <p className="mt-1 text-xs text-zinc-600">
              Connect a wallet and register a requester or provider agent to begin.
            </p>
          </div>
        )}
      </div>

      {/* ── Network Summary ─────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6">
        <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <Activity className="h-3.5 w-3.5 text-amber-500/70" />
          Network Summary
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <SummaryItem
            label="Total Agents"
            value={String(visibleAgents.length)}
            icon={<Users className="h-4 w-4 text-blue-400" />}
          />
          <SummaryItem
            label="Total Settlements"
            value={totalSettlements.toLocaleString()}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          />
          <SummaryItem
            label="Total Volume"
            value={formatUSDC(totalVolume)}
            icon={<BarChart3 className="h-4 w-4 text-amber-400" />}
          />
          <SummaryItem
            label="Active Escrows"
            value={String(totalActiveEscrows)}
            icon={<Lock className="h-4 w-4 text-purple-400" />}
          />
        </div>
      </div>
    </div>
  );
}

// ── Agent Card ─────────────────────────────────────────────

function AgentCard({ agent }: { agent: Agent }) {
  const badge = typeBadge(agent.type);

  return (
    <div className="group rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 transition-all duration-200 hover:border-amber-500/40 hover:bg-zinc-900/60">
      {/* Top row: avatar · name · badges */}
      <div className="flex items-start gap-3.5">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-lg ring-1 ring-zinc-700/50">
          {agent.avatar}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-zinc-100">
              {agent.name}
            </h3>
          </div>

          {/* Badges */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {/* Role pill */}
            <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-zinc-700/40">
              {roleLabels[agent.role] ?? agent.role}
            </span>
            {/* Type pill */}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                badge.cls
              )}
            >
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 truncate text-xs leading-relaxed text-zinc-500">
        {agent.description}
      </p>

      {/* Divider */}
      <div className="my-3.5 h-px bg-zinc-800/60" />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCell
          label="Settlements"
          value={agent.completedSettlements.toLocaleString()}
          icon={<CheckCircle2 className="h-3 w-3 text-zinc-600" />}
        />
        <StatCell
          label="Success"
          value={formatPercent(agent.successRate)}
          icon={<TrendingUp className="h-3 w-3 text-zinc-600" />}
          valueClass={agent.successRate >= 98 ? "text-emerald-400" : "text-zinc-300"}
        />
        <div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Shield className="h-3 w-3" />
            Reputation
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "font-mono text-sm font-medium",
                reputationColor(agent.reputationScore)
              )}
            >
              {formatReputationScore(agent.reputationScore)}
            </span>
            {/* Mini bar */}
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  reputationBarColor(agent.reputationScore)
                )}
                style={{ width: `${clampPercent(agent.reputationScore)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="my-3.5 h-px bg-zinc-800/60" />

      {/* Financial row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <ArrowUpRight className="h-3 w-3 text-emerald-500/60" />
            Earned
          </div>
          <p className="mt-0.5 font-mono text-sm font-medium text-zinc-200">
            {formatUSDC(agent.totalEarnings)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-600">
            <ArrowDownRight className="h-3 w-3 text-amber-500/60" />
            Spent
          </div>
          <p className="mt-0.5 font-mono text-sm font-medium text-zinc-200">
            {formatUSDC(agent.totalSpending)}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="my-3.5 h-px bg-zinc-800/60" />

      {/* Footer: wallet + escrows */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Wallet className="h-3 w-3" />
          <span className="font-mono text-zinc-500">{agent.walletAddress}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-zinc-700/40">
          <Lock className="h-2.5 w-2.5 text-amber-500/70" />
          {agent.activeEscrows} Escrow{agent.activeEscrows !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

// ── Stat Cell ──────────────────────────────────────────────

function StatCell({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-zinc-600">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-medium",
          valueClass ?? "text-zinc-300"
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ── Summary Item ───────────────────────────────────────────

function SummaryItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">
        {value}
      </p>
    </div>
  );
}
