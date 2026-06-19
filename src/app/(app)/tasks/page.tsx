"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useConnectedWallet } from "@/hooks/useConnectedWallet";
import {
  type Agent,
  type PricingModel,
  type Task,
  type TaskStatus,
} from "@/lib/mock-data";
import { formatUSDC, formatTimeAgo, cn } from "@/lib/utils";
import { areSameWallet } from "@/lib/wallet-validation";
import {
  FileText,
  ArrowRight,
  Clock,
  CircleDot,
  CheckCircle2,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Layers,
  DollarSign,
  Timer,
  Plus,
} from "lucide-react";

// ── Status helpers ────────────────────────────────────────────

const statusConfig: Record<
  TaskStatus,
  { label: string; color: string; bg: string; ring: string; pulse?: boolean }
> = {
  created: {
    label: "Open",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    ring: "ring-zinc-500/30",
  },
  assigned: {
    label: "In Escrow",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/30",
  },
  "in-progress": {
    label: "Accepted",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/30",
    pulse: true,
  },
  delivered: {
    label: "Submitted",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/30",
  },
  verified: {
    label: "Verified",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/30",
  },
  settled: {
    label: "Settled",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/30",
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/30",
  },
};

const pricingLabels: Record<string, string> = {
  "per-task": "Per Task",
  "per-call": "Per Call",
  "per-second": "Per Second",
  "per-byte": "Per Byte",
  milestone: "Milestone",
};

type FilterTab = "all" | "open" | "active" | "verified" | "settled" | "failed";

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "active", label: "Active" },
  { key: "verified", label: "Verified" },
  { key: "settled", label: "Settled" },
  { key: "failed", label: "Failed" },
];

function filterTasks(tasks: Task[], filter: FilterTab): Task[] {
  switch (filter) {
    case "open":
      return tasks.filter((t) => t.status === "created" && !t.providerId);
    case "active":
      return tasks.filter((t) =>
        ["assigned", "in-progress", "delivered"].includes(t.status)
      );
    case "verified":
      return tasks.filter((t) => t.status === "verified");
    case "settled":
      return tasks.filter((t) => t.status === "settled");
    case "failed":
      return tasks.filter((t) => t.status === "failed");
    default:
      return tasks;
  }
}

function getAgentTime(agent: Agent): number {
  const registeredAt = new Date(agent.registeredAt).getTime();
  return Number.isFinite(registeredAt) ? registeredAt : 0;
}

function sortAgentsForWallet(agents: Agent[], walletAddress: string | null): Agent[] {
  return [...agents].sort((a, b) => {
    const aOwned = Boolean(walletAddress && areSameWallet(a.walletAddress, walletAddress));
    const bOwned = Boolean(walletAddress && areSameWallet(b.walletAddress, walletAddress));

    if (aOwned !== bOwned) return aOwned ? -1 : 1;
    return getAgentTime(b) - getAgentTime(a);
  });
}

// ── Pipeline statuses (for the visual) ────────────────────────

const pipelineSteps: { status: TaskStatus; label: string }[] = [
  { status: "created", label: "Open" },
  { status: "in-progress", label: "Accepted" },
  { status: "assigned", label: "In Escrow" },
  { status: "delivered", label: "Submitted" },
  { status: "verified", label: "Verified" },
  { status: "settled", label: "Settled" },
];

function getStatusCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    created: 0,
    assigned: 0,
    "in-progress": 0,
    delivered: 0,
    verified: 0,
    settled: 0,
    failed: 0,
  };
  tasks.forEach((t) => counts[t.status]++);
  return counts;
}

// ── Deadline helper ───────────────────────────────────────────

function formatDeadline(dateInput: Date | string | number): { text: string; urgent: boolean } {
  const deadline = new Date(dateInput);
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = diff / 3600000;

  if (diff < 0) {
    const ago = formatTimeAgo(deadline);
    return { text: `Overdue (${ago})`, urgent: true };
  }
  if (hours < 24) {
    return { text: `${Math.floor(hours)}h remaining`, urgent: true };
  }
  const days = Math.floor(hours / 24);
  return { text: `${days}d remaining`, urgent: false };
}

// ── Components ────────────────────────────────────────────────

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-all",
        cfg.bg,
        cfg.color,
        cfg.ring
      )}
    >
      {cfg.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
        </span>
      )}
      {cfg.label}
    </span>
  );
}

function PricingPill({ model }: { model: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400 ring-1 ring-inset ring-zinc-700/60">
      <DollarSign className="h-3 w-3" />
      {pricingLabels[model] || model}
    </span>
  );
}

function MilestoneBar({
  milestones,
}: {
  milestones: NonNullable<Task["milestones"]>;
}) {
  const completed = milestones.filter(
    (m) => m.status === "released" || m.status === "verified"
  ).length;
  const total = milestones.length;
  const pct = (completed / total) * 100;

  return (
    <div className="flex items-center gap-2.5">
      <Layers className="h-3.5 w-3.5 text-zinc-500" />
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-zinc-500">
        {completed}/{total}
      </span>
    </div>
  );
}

function PipelineVisual({ counts }: { counts: Record<TaskStatus, number> }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between min-w-[600px]">
        {pipelineSteps.map((step, i) => {
          const count = counts[step.status];
          const isActive = count > 0;
          const cfg = statusConfig[step.status];

          return (
            <div key={step.status} className="flex items-center flex-1">
              {/* Node */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="relative">
                  {isActive && (
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full blur-md opacity-40",
                        step.status === "settled"
                          ? "bg-emerald-500"
                          : step.status === "in-progress" ||
                            step.status === "assigned"
                          ? "bg-blue-500"
                          : step.status === "delivered" ||
                            step.status === "verified"
                          ? "bg-amber-500"
                          : "bg-zinc-500"
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isActive
                        ? cn(
                            "border-current",
                            cfg.color,
                            cfg.bg
                          )
                        : "border-zinc-700/50 bg-zinc-900 text-zinc-600"
                    )}
                  >
                    <span className="text-sm font-semibold font-mono">
                      {count}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap transition-colors",
                    isActive ? cfg.color : "text-zinc-600"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < pipelineSteps.length - 1 && (
                <div className="flex-shrink-0 w-full max-w-[60px] h-[2px] mx-1 relative -mt-6">
                  <div className="absolute inset-0 bg-zinc-800 rounded-full" />
                  {isActive && counts[pipelineSteps[i + 1].status] > 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/30 to-amber-500/10 rounded-full" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  agentsById,
  walletAddress,
  acceptingTaskId,
  onAcceptTask,
}: {
  task: Task;
  agentsById: Record<string, Agent>;
  walletAddress: string | null;
  acceptingTaskId?: string;
  onAcceptTask?: (task: Task) => void;
}) {
  const requester = agentsById[task.requesterId];
  const provider = task.providerId ? agentsById[task.providerId] : undefined;
  const deadline = formatDeadline(task.deadline);
  const isTerminal = task.status === "settled" || task.status === "failed";
  const isOpen = task.status === "created" && !task.providerId;
  const connectedWalletCanAccept = Boolean(
    walletAddress && requester && !areSameWallet(requester.walletAddress, walletAddress)
  );

  return (
    <div
      id={`task-${task.id}`}
      className={cn(
        "group relative rounded-xl border bg-zinc-900/50 p-5 transition-all duration-300",
        "hover:bg-zinc-900/80 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/20",
        task.status === "failed"
          ? "border-red-500/20"
          : task.status === "settled"
          ? "border-emerald-500/15"
          : "border-zinc-800"
      )}
    >
      {/* Top row: ID + Status + Pricing */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="font-mono text-xs text-zinc-500">
              {task.id}
            </span>
            <StatusBadge status={task.status} />
            <PricingPill model={task.pricingModel} />
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors">
            {task.title}
          </h3>
        </div>

        {/* Amount */}
        <div className="flex-shrink-0 text-right">
          <p className="font-mono text-lg font-semibold text-zinc-100">
            {formatUSDC(task.amount)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">USDC</p>
        </div>
      </div>

      {/* Agents row */}
      <div className="mt-4 flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{requester?.avatar}</span>
          <span className="text-zinc-400">{requester?.name || task.requesterId}</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider ml-0.5">req</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-zinc-600 mx-1" />
        <div className="flex items-center gap-1.5">
          <span className="text-base">{provider?.avatar ?? "OP"}</span>
          <span className="text-zinc-400">{provider?.name || "Open Task"}</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider ml-0.5">prov</span>
        </div>
      </div>

      {/* Milestones bar */}
      {task.milestones && task.milestones.length > 0 && (
        <div className="mt-3">
          <MilestoneBar milestones={task.milestones} />
        </div>
      )}

      {/* Footer: deadline */}
      <div className="mt-3.5 flex items-center justify-between border-t border-zinc-800/60 pt-3">
        <div className="flex items-center gap-1.5 text-xs">
          {isTerminal ? (
            <>
              {task.status === "settled" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className={task.status === "settled" ? "text-emerald-500" : "text-red-500"}>
                {task.status === "settled" ? "Settled" : "Failed"} {formatTimeAgo(task.deadline)}
              </span>
            </>
          ) : (
            <>
              <Timer
                className={cn(
                  "h-3.5 w-3.5",
                  deadline.urgent ? "text-amber-500" : "text-zinc-500"
                )}
              />
              <span
                className={cn(
                  deadline.urgent ? "text-amber-400" : "text-zinc-500"
                )}
              >
                {deadline.text}
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-zinc-600">
          Created {formatTimeAgo(task.createdAt)}
        </span>
      </div>
      {isOpen && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-3">
          <span className="text-xs text-zinc-500">
            {walletAddress
              ? connectedWalletCanAccept
                ? "Connected provider wallet can accept this task, then the requester funds escrow."
                : "Requester wallet cannot accept its own task."
              : "Open for a provider wallet to accept."}
          </span>
          <button
            type="button"
            onClick={() => onAcceptTask?.(task)}
            disabled={!connectedWalletCanAccept || acceptingTaskId === task.id}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {acceptingTaskId === task.id ? "Accepting" : "Accept Task"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledTaskParam = useRef<string | null>(null);
  const { data, loading, error, mutate } = useApi<{
    tasks: Task[];
    agentsById: Record<string, Agent>;
    dataSource: {
      hasSampleRecords: boolean;
    };
  }>("/api/tasks");
  const walletAddress = useConnectedWallet();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [pipelineOpen, setPipelineOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [acceptingTaskId, setAcceptingTaskId] = useState("");
  const [formError, setFormError] = useState("");
  const [agentAction, setAgentAction] = useState("");
  const [agentError, setAgentError] = useState("");
  const [localTasksById, setLocalTasksById] = useState<Record<string, Task>>({});
  const [localAgentsById, setLocalAgentsById] = useState<Record<string, Agent>>({});
  const [taskForm, setTaskForm] = useState<{
    title: string;
    requesterId: string;
    providerId: string;
    amount: string;
    pricingModel: PricingModel;
    verificationCriteria: string;
  }>({
    title: "",
    requesterId: "",
    providerId: "",
    amount: "0.000001",
    pricingModel: "per-task",
    verificationCriteria: "",
  });
  const tasks = useMemo(() => {
    const merged = new Map<string, Task>();
    for (const task of data?.tasks ?? []) merged.set(task.id, task);
    for (const task of Object.values(localTasksById)) merged.set(task.id, task);
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data?.tasks, localTasksById]);
  const agentsById = useMemo(
    () => ({ ...(data?.agentsById ?? {}), ...localAgentsById }),
    [data?.agentsById, localAgentsById]
  );
  const agents = useMemo(() => Object.values(agentsById), [agentsById]);
  const requesters = sortAgentsForWallet(
    agents.filter((agent) => agent.type === "requester" || agent.type === "both"),
    walletAddress
  );
  const missingRequester = requesters.length === 0;

  const counts = getStatusCounts(tasks);
  const filteredTasks = filterTasks(tasks, activeFilter);

  const activeTasks = tasks.filter((t) =>
    ["assigned", "in-progress", "delivered"].includes(t.status)
  ).length;
  const settledTasks = counts.settled;
  const failedTasks = counts.failed;
  const selectedRequesterId = taskForm.requesterId || requesters[0]?.id || "";
  const selectedRequester = agentsById[selectedRequesterId];
  const connectedRequesterMatchesSelection = areSameWallet(
    selectedRequester?.walletAddress,
    walletAddress
  );
  const canCreateTask = Boolean(
    walletAddress &&
      taskForm.title.trim() &&
      selectedRequesterId &&
      connectedRequesterMatchesSelection &&
      Number(taskForm.amount) > 0 &&
      taskForm.verificationCriteria.trim()
  );

  useEffect(() => {
    if (searchParams.get("focus") === "create-task") {
      if (handledTaskParam.current === "focus:create-task") return;
      handledTaskParam.current = "focus:create-task";
      window.requestAnimationFrame(() => {
        document.getElementById("create-task-form")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    const taskId = searchParams.get("task");
    if (!taskId || tasks.length === 0) return;
    if (handledTaskParam.current === taskId) return;

    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    handledTaskParam.current = taskId;

    window.requestAnimationFrame(() => {
      setActiveFilter(task.status === "created" && !task.providerId ? "open" : "active");
      document.getElementById(`task-${task.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [searchParams, tasks]);

  if (error) return <div className="p-8 text-red-500 border border-red-500/20 bg-red-500/10 rounded-md m-4">Error loading data: {error.message}</div>;
  if (!data && loading) return <div className="animate-pulse p-8 text-zinc-500">Loading...</div>;

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateTask) return;

    setSubmitting(true);
    setFormError("");

    try {
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.verificationCriteria,
          requesterId: selectedRequesterId,
          amount: Number(taskForm.amount),
          pricingModel: taskForm.pricingModel,
          deliverables: taskForm.verificationCriteria,
          verificationCriteria: taskForm.verificationCriteria,
          deadline,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Task creation failed");
      }

      const payload = (await response.json()) as { task?: Task };
      if (payload.task) {
        setLocalTasksById((current) => ({ ...current, [payload.task!.id]: payload.task! }));
      }

      setTaskForm({
        title: "",
        requesterId: "",
        providerId: "",
        amount: "0.000001",
        pricingModel: "per-task",
        verificationCriteria: "",
      });
      setActiveFilter("open");
      if (payload.task?.id) {
        router.replace(`/tasks?task=${encodeURIComponent(payload.task.id)}`);
      }
      void mutate(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Task creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function registerRequesterAgent() {
    if (!walletAddress) return;

    setAgentAction("requester");
    setAgentError("");

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Requester Agent",
          role: "orchestrator",
          type: "requester",
          description: "Requester agent created from the task flow.",
          walletAddress,
          avatar: "RA",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Agent registration failed");
      }

      const payload = (await response.json()) as { agent?: Agent };
      if (payload.agent) {
        setLocalAgentsById((current) => ({ ...current, [payload.agent!.id]: payload.agent! }));
        setTaskForm((form) => ({
          ...form,
          requesterId: payload.agent?.id ?? form.requesterId,
        }));
      }

      window.requestAnimationFrame(() => {
        document.getElementById("create-task-form")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      void mutate(true);
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Agent registration failed");
    } finally {
      setAgentAction("");
    }
  }

  async function acceptTask(task: Task) {
    if (!walletAddress) return;

    setAcceptingTaskId(task.id);
    setFormError("");

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept-task",
          taskId: task.id,
          walletAddress,
        }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({ error: response.statusText }))) as { error?: string };
        throw new Error(payload.error ?? "Task acceptance failed");
      }

      const payload = (await response.json()) as {
        task?: Task;
        agentsById?: Record<string, Agent>;
      };
      if (payload.task) {
        setLocalTasksById((current) => ({ ...current, [payload.task!.id]: payload.task! }));
      }
      if (payload.agentsById) {
        setLocalAgentsById((current) => ({ ...current, ...payload.agentsById }));
      }
      if (payload.task && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "proovra:accepted-task-handoff",
          JSON.stringify({
            task: payload.task,
            agentsById: payload.agentsById ?? agentsById,
          })
        );
      }
      if (payload.task?.id) {
        router.push(`/settlement?task=${encodeURIComponent(payload.task.id)}`);
      } else {
        router.push("/settlement");
      }
      void mutate(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Task acceptance failed");
    } finally {
      setAcceptingTaskId("");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Task Agreements
            </h1>
          </div>
          <p className="text-sm text-zinc-500 ml-[42px]">
            Persisted task records between agents in the settlement network
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="font-mono text-zinc-400">{tasks.length}</span>
          <span className="text-zinc-600">total</span>
          <span className="text-zinc-700 mx-1">·</span>
          <span className="font-mono text-blue-400">{activeTasks}</span>
          <span className="text-zinc-600">Active</span>
          <span className="text-zinc-700 mx-1">·</span>
          <span className="font-mono text-emerald-400">{settledTasks}</span>
          <span className="text-zinc-600">Settled</span>
          <span className="text-zinc-700 mx-1">·</span>
          <span className="font-mono text-red-400">{failedTasks}</span>
          <span className="text-zinc-600">Failed</span>
        </div>
      </div>

      <form
        id="create-task-form"
        onSubmit={createTask}
        className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Create Task</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Create an open proof requirement for provider acceptance.
            </p>
          </div>
          {!walletAddress && (
            <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-500">
              Connect wallet to create tasks
            </span>
          )}
        </div>

        {missingRequester && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Requester required
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Create a requester agent before opening a proof-gated task.
                  Providers can register later and accept open tasks.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {missingRequester && (
                  <button
                    type="button"
                    onClick={registerRequesterAgent}
                    disabled={!walletAddress || Boolean(agentAction)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {agentAction === "requester" ? "Registering" : "Register Requester"}
                  </button>
                )}
              </div>
            </div>
            {!walletAddress && (
              <p className="mt-2 text-xs text-zinc-500">
                Connect wallet first so agent records can use a real wallet address.
              </p>
            )}
            {agentError && <p className="mt-2 text-xs text-red-400">{agentError}</p>}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_0.7fr_0.8fr]">
          <input
            value={taskForm.title}
            onChange={(event) => setTaskForm((form) => ({ ...form, title: event.target.value }))}
            placeholder="Task name"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <select
            value={selectedRequesterId}
            onChange={(event) =>
              setTaskForm((form) => ({ ...form, requesterId: event.target.value }))
            }
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500/50"
          >
            <option value="">Requester agent</option>
            {requesters.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <input
            value={taskForm.amount}
            onChange={(event) => setTaskForm((form) => ({ ...form, amount: event.target.value }))}
            inputMode="decimal"
            placeholder="Amount"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <select
            value={taskForm.pricingModel}
            onChange={(event) =>
              setTaskForm((form) => ({ ...form, pricingModel: event.target.value as PricingModel }))
            }
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500/50"
          >
            <option value="per-task">Per Task</option>
            <option value="per-call">Per Call</option>
            <option value="per-second">Per Second</option>
            <option value="per-byte">Per Byte</option>
            <option value="milestone">Milestone</option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={taskForm.verificationCriteria}
            onChange={(event) =>
              setTaskForm((form) => ({ ...form, verificationCriteria: event.target.value }))
            }
            placeholder="Proof requirement"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <button
            type="submit"
            disabled={!canCreateTask || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
          >
            <Plus className="h-4 w-4" />
            {submitting ? "Creating" : "Create Task"}
          </button>
        </div>
        {formError && <p className="mt-3 text-xs text-red-400">{formError}</p>}
        {!canCreateTask && (
          <p className="mt-3 text-xs text-zinc-500">
            {missingRequester
              ? "Register a requester agent, then fill the task name and proof requirement."
              : !walletAddress
              ? "Connect wallet to create tasks."
              : !connectedRequesterMatchesSelection
              ? "Connect the requester wallet selected above to create this task."
              : "Fill the task name and proof requirement to enable task creation."}
          </p>
        )}
      </form>

      {/* ── Status Pipeline ─────────────────────────────────── */}
      <div id="task-workflow" className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <button
          onClick={() => setPipelineOpen(!pipelineOpen)}
          className="flex w-full items-center justify-between px-5 py-3 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-zinc-300">Settlement Pipeline</span>
          </div>
          {pipelineOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {pipelineOpen && (
          <div className="px-5 pb-5 pt-1">
            <PipelineVisual counts={counts} />
            {/* Failed indicator */}
            {counts.failed > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs text-red-400 font-medium">
                  {counts.failed} failed
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-900/60 border border-zinc-800 p-1 w-fit">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          const count =
            tab.key === "all"
              ? tasks.length
              : filterTasks(tasks, tab.key).length;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "font-mono text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                  isActive
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-zinc-800 text-zinc-600"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tasks List ──────────────────────────────────────── */}
      <div className="space-y-3">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              agentsById={agentsById}
              walletAddress={walletAddress}
              acceptingTaskId={acceptingTaskId}
              onAcceptTask={acceptTask}
            />
          ))
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 py-16 text-center">
            <CircleDot className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
            <p className="text-sm font-medium text-zinc-400">
              {tasks.length === 0 ? "No tasks created yet" : "No tasks match this filter"}
            </p>
            {tasks.length === 0 && (
              <p className="mt-1 text-xs text-zinc-600">
                Register a requester agent, then create an open proof-gated task for providers to accept.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Summary Footer ──────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/20 px-5 py-3">
        <span className="text-xs text-zinc-600">
          Showing {filteredTasks.length} of {tasks.length} task agreements
        </span>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Clock className="h-3 w-3" />
          <span>Last synced just now</span>
        </div>
      </div>
    </div>
  );
}
