"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useConnectedWallet } from "@/hooks/useConnectedWallet";
import { 
  ArrowRightLeft, 
  CircleDot, 
  Lock, 
  Upload, 
  ShieldCheck, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Receipt as ReceiptIcon,
  Activity,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import type { Agent, ProofFile, Settlement, Task } from "@/lib/mock-data";
import { formatUSDC, formatTimeAgo, cn } from "@/lib/utils";
import { getProofFileUrl } from "@/lib/proof-file-url";
import { areSameWallet } from "@/lib/wallet-validation";
import Link from "next/link";
import {
  ARC_TESTNET,
  encodeApprove,
  encodeCreateEscrow,
  encodeReleaseAfterProof,
  ensureArcTestnet,
  extractEscrowId,
  hashProofMaterial,
  sendWalletTransaction,
  toUsdcBaseUnits,
  waitForArcReceipt,
  type EthereumProvider,
} from "@/lib/arc-testnet-wallet";

type SettlementResponse = {
  settlements: Settlement[];
  agentsById: Record<string, Agent>;
  tasksById: Record<string, Task>;
  fundableTasks: Task[];
  dataSource: {
    hasSampleRecords: boolean;
  };
};

type AcceptedTaskHandoff = {
  task?: Task;
  agentsById?: Record<string, Agent>;
};

function readAcceptedTaskHandoff(): AcceptedTaskHandoff {
  if (typeof window === "undefined") return {};
  const raw = window.sessionStorage.getItem("proovra:accepted-task-handoff");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AcceptedTaskHandoff;
  } catch {
    window.sessionStorage.removeItem("proovra:accepted-task-handoff");
    return {};
  }
}

function isValidProofHash(value?: string) {
  return Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value.trim()));
}

function focusSettlement(settlementId: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(`settlement-${settlementId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function getEscrowProofCommitment(settlement: Settlement) {
  return settlement.escrowProofCommitment ?? settlement.proofHash;
}

const settlementStatusRank: Record<Settlement["escrowStatus"], number> = {
  created: 0,
  funded: 1,
  submitted: 2,
  verified: 3,
  released: 4,
  refunded: 4,
  failed: 4,
};

function isStaleSettlementState(previous: Settlement, next: Settlement) {
  return settlementStatusRank[next.escrowStatus] < settlementStatusRank[previous.escrowStatus];
}

function mergeSettlementState(previous: Settlement | undefined, next: Settlement) {
  if (previous && isStaleSettlementState(previous, next)) {
    return previous;
  }
  return next;
}

async function fetchSettlementSnapshot() {
  const response = await fetch("/api/settlements", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: response.statusText }))) as {
      error?: string;
    };
    throw new Error(payload.error ?? "Latest settlement refresh failed");
  }
  return (await response.json()) as SettlementResponse;
}

export default function SettlementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledSettlementParam = useRef("");
  const [filter, setFilter] = useState<"all" | "released" | "in-progress" | "failed">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const activeSettlementId = expandedId ?? searchParams.get("settlement");
  const keepActiveSettlement = useCallback(
    (previous: SettlementResponse, next: SettlementResponse) => {
      const nextById = new Map(next.settlements.map((settlement) => [settlement.id, settlement]));
      const hasStaleDowngrade = previous.settlements.some((settlement) => {
        const nextSettlement = nextById.get(settlement.id);
        return Boolean(nextSettlement && isStaleSettlementState(settlement, nextSettlement));
      });

      return Boolean(
        hasStaleDowngrade ||
          (activeSettlementId &&
            previous.settlements.some((settlement) => settlement.id === activeSettlementId) &&
            !next.settlements.some((settlement) => settlement.id === activeSettlementId))
      );
    },
    [activeSettlementId]
  );
  const { data, loading, error, mutate, preservedPrevious } = useApi<SettlementResponse>(
    "/api/settlements",
    { shouldKeepPrevious: keepActiveSettlement }
  );
  const walletAddress = useConnectedWallet();
  const [fundTaskId, setFundTaskId] = useState(() => readAcceptedTaskHandoff().task?.id ?? "");
  const [fundProofText, setFundProofText] = useState("");
  const [actionId, setActionId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [proofInputs, setProofInputs] = useState<
    Record<string, { proofHash: string; proofUrl: string; proofText: string; proofFile?: ProofFile }>
  >({});
  const [uploadingProofId, setUploadingProofId] = useState("");
  const [localSettlementsById, setLocalSettlementsById] = useState<Record<string, Settlement>>({});
  const [localTasksById, setLocalTasksById] = useState<Record<string, Task>>(() => {
    const task = readAcceptedTaskHandoff().task;
    return task ? { [task.id]: task } : {};
  });
  const [localAgentsById] = useState<Record<string, Agent>>(
    () => readAcceptedTaskHandoff().agentsById ?? {}
  );
  const settlements = useMemo(() => {
    const merged = new Map<string, Settlement>();
    for (const settlement of data?.settlements ?? []) {
      merged.set(settlement.id, mergeSettlementState(merged.get(settlement.id), settlement));
    }
    for (const settlement of Object.values(localSettlementsById)) {
      merged.set(settlement.id, mergeSettlementState(merged.get(settlement.id), settlement));
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data?.settlements, localSettlementsById]);
  const agentsById = useMemo(
    () => ({ ...(data?.agentsById ?? {}), ...localAgentsById }),
    [data?.agentsById, localAgentsById]
  );
  const tasksById = useMemo(
    () => ({ ...(data?.tasksById ?? {}), ...localTasksById }),
    [data?.tasksById, localTasksById]
  );
  const fundableTasks = useMemo(() => {
    const settledTaskIds = new Set(settlements.map((settlement) => settlement.taskId));
    const merged = new Map<string, Task>();
    for (const task of data?.fundableTasks ?? []) merged.set(task.id, task);
    for (const task of Object.values(localTasksById)) {
      if (
        !settledTaskIds.has(task.id) &&
        task.status !== "settled" &&
        task.status !== "failed" &&
        task.providerId &&
        !areSameWallet(
          agentsById[task.requesterId]?.walletAddress,
          agentsById[task.providerId]?.walletAddress
        )
      ) {
        merged.set(task.id, task);
      }
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [agentsById, data?.fundableTasks, localTasksById, settlements]);
  const selectedFundTask = fundableTasks.find((candidate) => candidate.id === fundTaskId);
  const selectedFundRequester = selectedFundTask ? agentsById[selectedFundTask.requesterId] : undefined;
  const connectedCanFundSelectedTask = Boolean(
    walletAddress &&
      selectedFundTask &&
      areSameWallet(selectedFundRequester?.walletAddress, walletAddress)
  );

  useEffect(() => {
    const taskId = searchParams.get("task");
    const settlementId = searchParams.get("settlement");
    const handledKey = settlementId ? `settlement:${settlementId}` : taskId ? `task:${taskId}` : "";
    if (handledKey && handledSettlementParam.current === handledKey) return;

    if (settlementId) {
      handledSettlementParam.current = handledKey;
      window.requestAnimationFrame(() => {
        setExpandedId(settlementId);
        setFilter("in-progress");
        document.getElementById(`settlement-${settlementId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    if (taskId && fundableTasks.some((task) => task.id === taskId)) {
      handledSettlementParam.current = handledKey;
      window.requestAnimationFrame(() => {
        setFundTaskId(taskId);
        document.getElementById("settlement-actions")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [fundableTasks, searchParams]);

  if (error && !data) return <div className="p-8 text-red-500 border border-red-500/20 bg-red-500/10 rounded-md m-4">Error loading data: {error.message}</div>;
  if (!data && loading) return <div className="animate-pulse p-8 text-zinc-500">Loading settlements...</div>;

  const filteredSettlements = settlements.filter(s => {
    if (filter === "all") return true;
    if (filter === "released") return s.escrowStatus === "released";
    if (filter === "failed") return s.escrowStatus === "failed" || s.escrowStatus === "refunded";
    return ["created", "funded", "submitted", "verified"].includes(s.escrowStatus);
  });

  const getStatusColor = (status: Settlement["escrowStatus"]) => {
    switch (status) {
      case "released": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "verified": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      case "submitted": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "funded": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      case "created": return "text-zinc-400 bg-zinc-800 border-zinc-700";
      case "refunded":
      case "failed": return "text-red-500 bg-red-500/10 border-red-500/20";
    }
  };

  const getStatusText = (status: Settlement["escrowStatus"]) => {
    switch (status) {
      case "released": return "Released";
      case "verified": return "Verified";
      case "submitted": return "Submitted";
      case "funded": return "Funded";
      case "created": return "Created";
      case "refunded": return "Refunded";
      case "failed": return "Failed";
    }
  };

  const stats = {
    created: Object.values(tasksById).filter((task) => task.status === "created" && !task.providerId).length,
    accepted: fundableTasks.filter((task) => task.status === "in-progress").length,
    released: settlements.filter(s => s.escrowStatus === "released").length,
    submitted: settlements.filter(s => s.escrowStatus === "submitted").length,
    verified: settlements.filter(s => s.escrowStatus === "verified").length,
    inVerification: settlements.filter(s => s.escrowStatus === "submitted" || s.escrowStatus === "verified").length,
    inEscrow: settlements.filter(s => s.escrowStatus === "created" || s.escrowStatus === "funded").length,
    failed: settlements.filter(s => s.escrowStatus === "failed" || s.escrowStatus === "refunded").length,
  };

  async function fundEscrow() {
    const task = fundableTasks.find((candidate) => candidate.id === fundTaskId);
    if (!task || !walletAddress) return;

    setActionId(`fund-${task.id}`);
    setActionError("");
    setActionMessage("");

    try {
      const ethereum = (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask or Rabby wallet is required to fund escrow on Arc Testnet.");
      }
      const requester = agentsById[task.requesterId];
      const provider = task.providerId ? agentsById[task.providerId] : undefined;
      if (!task.providerId) {
        throw new Error("Provider must accept the task before escrow funding.");
      }
      if (!provider?.walletAddress) {
        throw new Error("Provider wallet address is required before funding escrow.");
      }
      if (areSameWallet(requester?.walletAddress, provider.walletAddress)) {
        throw new Error("Requester wallet and provider wallet must be different before escrow funding.");
      }
      if (requester?.walletAddress?.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error("Connected wallet must match the requester agent wallet.");
      }
      const proofCommitmentText = fundProofText.trim() || task.verificationCriteria;
      const proofHash = await hashProofMaterial(proofCommitmentText);
      const amountBaseUnits = toUsdcBaseUnits(task.amount);
      const deadline = new Date(task.deadline);
      if (Number.isNaN(deadline.getTime())) {
        throw new Error("Task deadline is invalid. Create a new task before funding escrow.");
      }
      const expiresAt = Math.floor(deadline.getTime() / 1000);

      await ensureArcTestnet(ethereum);
      const approvalTxHash = await sendWalletTransaction(
        ethereum,
        walletAddress,
        ARC_TESTNET.usdcToken,
        encodeApprove(ARC_TESTNET.settlementContract, amountBaseUnits)
      );
      await waitForArcReceipt(approvalTxHash);

      const createTxHash = await sendWalletTransaction(
        ethereum,
        walletAddress,
        ARC_TESTNET.settlementContract,
        encodeCreateEscrow({
          provider: provider.walletAddress,
          token: ARC_TESTNET.usdcToken,
          amount: amountBaseUnits,
          proofHash,
          expiresAt,
        })
      );
      const createReceipt = await waitForArcReceipt(createTxHash);
      const externalEscrowId = extractEscrowId(createReceipt);

      const response = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          requesterId: task.requesterId,
          providerId: task.providerId,
          amount: task.amount,
          pricingModel: task.pricingModel,
          proofHash,
          walletAddress,
          txHash: createTxHash,
          blockNumber: createReceipt.blockNumber,
          externalEscrowId,
          contractAddress: ARC_TESTNET.settlementContract,
          explorerUrl: ARC_TESTNET.explorerUrl,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Escrow funding failed");
      }

      const payload = (await response.json()) as { settlement?: Settlement };
      if (payload.settlement) {
        setLocalSettlementsById((current) => ({
          ...current,
          [payload.settlement!.id]: mergeSettlementState(current[payload.settlement!.id], payload.settlement!),
        }));
        setLocalTasksById((current) => ({
          ...current,
          [task.id]: { ...task, status: "assigned" },
        }));
        window.sessionStorage.removeItem("proovra:accepted-task-handoff");
      }

      setFundTaskId("");
      setFundProofText("");
      if (payload.settlement?.id) {
        setExpandedId(payload.settlement.id);
        setFilter("in-progress");
        setActionMessage("Escrow funded. Waiting for Provider to submit proof.");
        router.replace(`/settlement?settlement=${encodeURIComponent(payload.settlement.id)}`);
        focusSettlement(payload.settlement.id);
      }
      void mutate(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Escrow funding failed");
    } finally {
      setActionId("");
    }
  }

  async function runSettlementAction(
    settlementId: string,
    action: "submit-proof" | "verify-proof" | "release-payment"
  ) {
    if (!walletAddress) return;

    setActionId(`${action}-${settlementId}`);
    setActionError("");
    setActionMessage("");

    try {
      let settlement = settlements.find((candidate) => candidate.id === settlementId);
      let latestAgentsById = agentsById;
      let latestTasksById = tasksById;
      if (action === "release-payment") {
        const snapshot = await fetchSettlementSnapshot();
        latestAgentsById = { ...snapshot.agentsById, ...localAgentsById };
        latestTasksById = { ...snapshot.tasksById, ...localTasksById };
        settlement =
          snapshot.settlements.find((candidate) => candidate.id === settlementId) ??
          settlement;
        if (settlement) {
          setLocalSettlementsById((current) => ({
            ...current,
            [settlement!.id]: mergeSettlementState(current[settlement!.id], settlement!),
          }));
        }
      }
      const requester = settlement ? latestAgentsById[settlement.requesterId] : undefined;
      const provider = settlement ? latestAgentsById[settlement.providerId] : undefined;
      if (!settlement) {
        throw new Error("Settlement not found. Refresh and try again.");
      }
      if (settlement && areSameWallet(requester?.walletAddress, provider?.walletAddress)) {
        throw new Error("Requester wallet and provider wallet must be different.");
      }
      if (action === "submit-proof" && !areSameWallet(provider?.walletAddress, walletAddress)) {
        throw new Error("Connect the provider wallet to submit proof.");
      }
      if (
        (action === "verify-proof" || action === "release-payment") &&
        !areSameWallet(requester?.walletAddress, walletAddress)
      ) {
        throw new Error(
          action === "verify-proof"
            ? "Connect the requester wallet to approve proof."
            : "Connect the requester wallet to release escrow."
        );
      }
      let releaseMetadata = {};
      if (action === "release-payment") {
        const ethereum = (window as typeof window & { ethereum?: EthereumProvider }).ethereum;
        if (!ethereum) {
          throw new Error("MetaMask or Rabby wallet is required to release escrow on Arc Testnet.");
        }
        if (settlement.escrowStatus === "released" || settlement.releaseTxHash) {
          throw new Error("This escrow has already been released.");
        }
        if (settlement.escrowStatus !== "verified" || settlement.verificationResult !== "passed") {
          throw new Error("Proof must be verified before release payment.");
        }
        const escrowProofCommitment = getEscrowProofCommitment(settlement);
        if (!settlement?.externalEscrowId || !escrowProofCommitment) {
          throw new Error("Arc escrow id and escrow proof commitment are required before release.");
        }
        await ensureArcTestnet(ethereum);
        const releaseTxHash = await sendWalletTransaction(
          ethereum,
          walletAddress,
          ARC_TESTNET.settlementContract,
          encodeReleaseAfterProof(settlement.externalEscrowId, escrowProofCommitment)
        );
        const releaseReceipt = await waitForArcReceipt(releaseTxHash);
        releaseMetadata = {
          walletAddress,
          txHash: releaseTxHash,
          blockNumber: releaseReceipt.blockNumber,
          contractAddress: ARC_TESTNET.settlementContract,
          explorerUrl: ARC_TESTNET.explorerUrl,
        };
      }

      const proofInput = proofInputs[settlementId];
      const submittedProofHash = proofInput?.proofHash?.trim();
      const submitProofPayload =
        action === "submit-proof" && settlement
          ? {
              proofHash: isValidProofHash(submittedProofHash) ? submittedProofHash : undefined,
              proofUrl: proofInput?.proofUrl?.trim() || undefined,
              proofFile: proofInput?.proofFile,
              proofText: proofInput?.proofText?.trim() || undefined,
            }
          : {};

      const response = await fetch("/api/settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId,
          action,
          verifier: walletAddress,
          walletAddress,
          approved: action === "verify-proof" ? true : undefined,
          ...submitProofPayload,
          ...releaseMetadata,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Settlement action failed");
      }

      const payload = (await response.json()) as { settlement?: Settlement };
      if (payload.settlement) {
        setLocalSettlementsById((current) => ({
          ...current,
          [payload.settlement!.id]: mergeSettlementState(current[payload.settlement!.id], payload.settlement!),
        }));
        const task = latestTasksById[payload.settlement.taskId];
        if (task) {
          setLocalTasksById((current) => ({
            ...current,
            [task.id]: {
              ...task,
              status:
                action === "submit-proof"
                  ? "delivered"
                  : action === "verify-proof"
                  ? "verified"
                  : action === "release-payment"
                  ? "settled"
                  : task.status,
            },
          }));
        }
      }
      if (payload.settlement?.id && action !== "release-payment") {
        setExpandedId(payload.settlement.id);
        setFilter("in-progress");
        router.replace(`/settlement?settlement=${encodeURIComponent(payload.settlement.id)}`);
        focusSettlement(payload.settlement.id);
      }
      setActionMessage(
        action === "submit-proof"
          ? "Proof submitted. Waiting for Requester to verify proof."
          : action === "verify-proof"
          ? "Proof approved. Requester can now release payment."
          : "Payment release recorded."
      );
      if (action === "release-payment") {
        const receiptId = payload.settlement?.receiptId;
        router.push(receiptId ? `/receipts?receipt=${encodeURIComponent(receiptId)}` : "/receipts");
      }
      void mutate(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Settlement action failed");
    } finally {
      setActionId("");
    }
  }

  async function uploadProofFile(settlementId: string, file?: File) {
    if (!file) return;

    setUploadingProofId(settlementId);
    setActionError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/proof-files", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({ error: `Proof file upload failed with HTTP ${response.status}` }))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Proof file upload failed");
      }

      const payload = (await response.json()) as { proofFile: ProofFile };
      setProofInputs((current) => ({
        ...current,
        [settlementId]: {
          ...(current[settlementId] ?? { proofHash: "", proofUrl: "", proofText: "" }),
          proofFile: payload.proofFile,
        },
      }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Proof file upload failed");
    } finally {
      setUploadingProofId("");
    }
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-amber-500" />
            Settlement Engine
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Proof-based settlements from persisted records</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 rounded-md">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">Active</span>
        </div>
      </div>

      {(error || preservedPrevious) && data && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          {error
            ? `Latest settlement refresh failed: ${error.message}. Keeping the current workflow visible.`
            : "Latest settlement refresh is still catching up. Keeping the current workflow visible."}
        </div>
      )}

      <div id="settlement-actions" className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Settlement Actions</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Fund created tasks, then submit proof, verify, and release from persisted state.
            </p>
          </div>
          {!walletAddress && (
            <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-500">
              Connect wallet to execute actions
            </span>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <select
            value={fundTaskId}
            onChange={(event) => setFundTaskId(event.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-amber-500/50"
          >
            <option value="">
              {fundableTasks.length ? "Select task to fund escrow" : "No unfunded tasks available"}
            </option>
            {fundableTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} · {formatUSDC(task.amount)}
              </option>
            ))}
          </select>
          <input
            value={fundProofText}
            onChange={(event) => setFundProofText(event.target.value)}
            placeholder="Proof commitment text"
            className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <button
            type="button"
            onClick={fundEscrow}
            disabled={!connectedCanFundSelectedTask || Boolean(actionId)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
          >
            <Lock className="h-4 w-4" />
            {actionId.startsWith("fund-") ? "Funding" : "Fund Escrow"}
          </button>
        </div>
        {walletAddress && selectedFundTask && !connectedCanFundSelectedTask && (
          <p className="mt-3 text-xs text-zinc-500">
            Connect the requester wallet for this task to fund escrow.
          </p>
        )}
        {actionError && <p className="mt-3 text-xs text-red-400">{actionError}</p>}
      </div>

      {/* Main Flow Visualization (HERO) */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-[0.015]"></div>
        <div className="absolute top-0 right-0 p-32 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col items-center justify-center space-y-12 relative z-10 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-5xl relative">
            
            {/* Connecting Lines (Background) */}
            <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-0.5 bg-zinc-800 -translate-y-1/2 z-0"></div>
            <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-zinc-600/50 via-amber-500/50 to-emerald-500/50 -translate-y-1/2 z-0"></div>

            {/* Nodes */}
            <PipelineNode icon={CircleDot} label="Created" count={stats.created} active={true} color="zinc" />
            <PipelineNode icon={CheckCircle2} label="Accepted" count={stats.accepted} active={true} color="blue" />
            <PipelineNode icon={Lock} label="Funded" count={stats.inEscrow} active={true} color="blue" />
            <PipelineNode icon={Upload} label="Submitted" count={stats.submitted} active={true} color="amber" glow />
            <PipelineNode icon={ShieldCheck} label="Verified" count={stats.verified} active={true} color="amber" glow />
            <PipelineNode icon={CheckCircle2} label="Released" count={stats.released} active={true} color="emerald" glow pulse />

          </div>
          
          <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-full flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-500 tracking-wide">Funds move ONLY after proof is verified</span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Settlements Released" value={stats.released} color="emerald" />
        <StatCard label="In Verification" value={stats.inVerification} color="amber" />
        <StatCard label="In Escrow" value={stats.inEscrow} color="blue" />
        <StatCard label="Failed/Refunded" value={stats.failed} color="red" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-px overflow-x-auto">
        <FilterTab label="All" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab label="Released" active={filter === "released"} onClick={() => setFilter("released")} color="emerald" />
        <FilterTab label="In Progress" active={filter === "in-progress"} onClick={() => setFilter("in-progress")} color="amber" />
        <FilterTab label="Failed" active={filter === "failed"} onClick={() => setFilter("failed")} color="red" />
      </div>

      {/* Settlement Feed */}
      <div className="space-y-3">
        {filteredSettlements.map((settlement) => {
          const task = tasksById[settlement.taskId];
          const requester = agentsById[settlement.requesterId];
          const provider = agentsById[settlement.providerId];
          const isExpanded = expandedId === settlement.id;
          const proofInput = proofInputs[settlement.id] ?? {
            proofHash: "",
            proofUrl: "",
            proofText: "",
            proofFile: settlement.proofFile,
          };
          const connectedIsRequester = areSameWallet(requester?.walletAddress, walletAddress);
          const connectedIsProvider = areSameWallet(provider?.walletAddress, walletAddress);
          const partiesShareWallet = areSameWallet(requester?.walletAddress, provider?.walletAddress);
          const roleGuidance =
            settlement.escrowStatus === "funded"
              ? connectedIsProvider
                ? "Provider can submit proof now."
                : "Waiting for Provider to submit proof."
              : settlement.escrowStatus === "submitted"
              ? connectedIsRequester
                ? "Requester can verify proof now."
                : "Waiting for Requester to verify proof."
              : settlement.escrowStatus === "verified"
              ? connectedIsRequester
                ? "Requester can release payment now."
                : "Waiting for Requester to release payment."
              : settlement.escrowStatus === "released"
              ? "Settlement complete. Receipt is ready for review."
              : "";
          
          return (
            <div
              id={`settlement-${settlement.id}`}
              key={settlement.id} 
              className={cn(
                "bg-zinc-900/50 border rounded-lg overflow-hidden transition-all duration-200",
                isExpanded ? "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
              )}
            >
              {/* Card Header (Clickable) */}
              <button 
                onClick={() => setExpandedId(isExpanded ? null : settlement.id)}
                className="w-full text-left p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={cn("px-2.5 py-1 rounded-md text-[10px] font-mono font-medium uppercase tracking-wider whitespace-nowrap", getStatusColor(settlement.escrowStatus))}>
                    {getStatusText(settlement.escrowStatus)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">{settlement.id}</span>
                      <span className="text-sm font-medium text-zinc-200 line-clamp-1">{task?.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <span>{requester?.avatar}</span> {requester?.name}
                      </span>
                      <ArrowRightLeft className="h-3 w-3 text-zinc-600" />
                      <span className="flex items-center gap-1">
                        <span>{provider?.avatar}</span> {provider?.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium text-white">{formatUSDC(settlement.amount)}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{settlement.pricingModel}</div>
                  </div>
                  <div className="text-right hidden sm:block w-24">
                    <div className="text-xs text-zinc-400">{settlement.settledAt ? formatTimeAgo(settlement.settledAt) : formatTimeAgo(settlement.createdAt)}</div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="bg-zinc-950/50 p-6 border-t border-zinc-800/50 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Vertical Pipeline */}
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Settlement Flow</h4>
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-zinc-800 before:to-transparent before:z-0">
                        <MiniFlowNode label="Escrow Created" time={formatTimeAgo(settlement.createdAt)} completed={true} />
                        <MiniFlowNode label="Funds Locked" completed={["funded", "submitted", "verified", "released"].includes(settlement.escrowStatus)} />
                        <MiniFlowNode label="Proof Submitted" completed={["submitted", "verified", "released"].includes(settlement.escrowStatus)} />
                        <MiniFlowNode label="Verification" completed={["verified", "released"].includes(settlement.escrowStatus)} status={settlement.verificationResult} />
                        <MiniFlowNode label="Funds Released" completed={settlement.escrowStatus === "released"} isLast />
                      </div>
                    </div>

                    {/* Technical Details */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Technical Details</h4>
                      
                      <DetailRow label="Proof Hash">
                        {settlement.proofHash ? (
                          <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs break-all bg-zinc-900 p-2 rounded border border-zinc-800">
                            {settlement.proofHash}
                          </div>
                        ) : <span className="text-zinc-600 italic">Awaiting submission</span>}
                      </DetailRow>

                      {settlement.proofFile && (
                        <DetailRow label="Proof File">
                          <div className="space-y-1 rounded border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-400">
                            <a
                              href={getProofFileUrl(settlement.proofFile)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-amber-400 hover:text-amber-300"
                            >
                              {settlement.proofFile.fileName}
                            </a>
                            <div>
                              {settlement.proofFile.fileType} · {(settlement.proofFile.fileSize / 1024).toFixed(1)} KB
                            </div>
                            {settlement.proofFile.fileHash && (
                              <div className="break-all font-mono text-[11px] text-zinc-500">
                                {settlement.proofFile.fileHash}
                              </div>
                            )}
                          </div>
                        </DetailRow>
                      )}
                      
                      <DetailRow label="Escrow Tx Hash">
                        {settlement.escrowTxHash ? (
                          <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs break-all bg-zinc-900 p-2 rounded border border-zinc-800">
                            {settlement.escrowExplorerLink ? (
                              <a href={settlement.escrowExplorerLink} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">
                                {settlement.escrowTxHash}
                              </a>
                            ) : (
                              settlement.escrowTxHash
                            )}
                          </div>
                        ) : <span className="text-zinc-600 italic">Pending settlement</span>}
                      </DetailRow>

                      <DetailRow label="Release Tx Hash">
                        {settlement.releaseTxHash ? (
                          <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs break-all bg-zinc-900 p-2 rounded border border-zinc-800">
                            {settlement.releaseExplorerLink ? (
                              <a href={settlement.releaseExplorerLink} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">
                                {settlement.releaseTxHash}
                              </a>
                            ) : (
                              settlement.releaseTxHash
                            )}
                          </div>
                        ) : <span className="text-zinc-600 italic">Pending release</span>}
                      </DetailRow>

                      {settlement.receiptId && (
                        <DetailRow label="Settlement Receipt">
                          <Link href="/receipts" className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                            <ReceiptIcon className="h-4 w-4" />
                            {settlement.receiptId}
                          </Link>
                        </DetailRow>
                      )}
                    </div>
                  </div>
                  {settlement.escrowStatus === "funded" && (
                    <div className="mt-6 grid gap-3 border-t border-zinc-800/60 pt-4 md:grid-cols-3">
                      <input
                        value={proofInput.proofHash}
                        onChange={(event) =>
                          setProofInputs((current) => ({
                            ...current,
                            [settlement.id]: {
                              ...proofInput,
                              proofHash: event.target.value,
                            },
                          }))
                        }
                        placeholder="Proof hash"
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
                      />
                      <input
                        value={proofInput.proofUrl}
                        onChange={(event) =>
                          setProofInputs((current) => ({
                            ...current,
                            [settlement.id]: {
                              ...proofInput,
                              proofUrl: event.target.value,
                            },
                          }))
                        }
                        placeholder="Proof URL"
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
                      />
                      <input
                        value={proofInput.proofText}
                        onChange={(event) =>
                          setProofInputs((current) => ({
                            ...current,
                            [settlement.id]: {
                              ...proofInput,
                              proofText: event.target.value,
                            },
                          }))
                        }
                        placeholder="Proof text"
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/50"
                      />
                      <div className="md:col-span-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-xs font-medium text-zinc-300">Proof file</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Optional evidence upload: images, PDFs, documents, spreadsheets, or slides.
                            </div>
                          </div>
                          <input
                            type="file"
                            accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            disabled={uploadingProofId === settlement.id}
                            onChange={(event) => {
                              void uploadProofFile(settlement.id, event.target.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                            className="max-w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border file:border-amber-500/20 file:bg-amber-500/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-amber-400 hover:file:bg-amber-500/15 disabled:cursor-not-allowed"
                          />
                        </div>
                        {uploadingProofId === settlement.id && (
                          <p className="mt-2 text-xs text-amber-400">Uploading proof file...</p>
                        )}
                        {proofInput.proofFile && (
                          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-400">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <a
                                href={getProofFileUrl(proofInput.proofFile)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-amber-400 hover:text-amber-300"
                              >
                                {proofInput.proofFile.fileName}
                              </a>
                              <span>
                                {proofInput.proofFile.fileType} · {(proofInput.proofFile.fileSize / 1024).toFixed(1)} KB
                              </span>
                            </div>
                            {proofInput.proofFile.fileHash && (
                              <div className="mt-1 break-all font-mono text-[11px] text-zinc-500">
                                {proofInput.proofFile.fileHash}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-zinc-800/60 pt-4">
                    <button
                      type="button"
                      onClick={() => runSettlementAction(settlement.id, "submit-proof")}
                      disabled={
                        !walletAddress ||
                        !connectedIsProvider ||
                        partiesShareWallet ||
                        settlement.escrowStatus !== "funded" ||
                        !(
                          proofInput.proofUrl.trim() ||
                          proofInput.proofText.trim() ||
                          proofInput.proofFile?.fileUrl
                        ) ||
                        uploadingProofId === settlement.id ||
                        Boolean(actionId)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {actionId === `submit-proof-${settlement.id}` ? "Submitting" : "Submit Proof"}
                    </button>
                    <button
                      type="button"
                      onClick={() => runSettlementAction(settlement.id, "verify-proof")}
                      disabled={
                        !walletAddress ||
                        !connectedIsRequester ||
                        partiesShareWallet ||
                        settlement.escrowStatus !== "submitted" ||
                        Boolean(actionId)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {actionId === `verify-proof-${settlement.id}` ? "Verifying" : "Verify Proof"}
                    </button>
                    <button
                      type="button"
                      onClick={() => runSettlementAction(settlement.id, "release-payment")}
                      disabled={
                        !walletAddress ||
                        !connectedIsRequester ||
                        partiesShareWallet ||
                        settlement.escrowStatus !== "verified" ||
                        Boolean(actionId)
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {actionId === `release-payment-${settlement.id}` ? "Releasing" : "Release Payment"}
                    </button>
                    {!walletAddress && (
                      <span className="text-xs text-zinc-500">Connect wallet to enable lifecycle actions.</span>
                    )}
                    {walletAddress && partiesShareWallet && (
                      <span className="text-xs text-red-400">
                        This settlement uses the same requester and provider wallet and cannot be progressed.
                      </span>
                    )}
                    {walletAddress && !partiesShareWallet && settlement.escrowStatus === "funded" && !connectedIsProvider && (
                      <span className="text-xs text-zinc-500">Connect provider wallet to submit proof.</span>
                    )}
                    {walletAddress && !partiesShareWallet && ["submitted", "verified"].includes(settlement.escrowStatus) && !connectedIsRequester && (
                      <span className="text-xs text-zinc-500">Connect requester wallet to approve and release.</span>
                    )}
                    {walletAddress && !partiesShareWallet && roleGuidance && (
                      <span className="text-xs text-zinc-500">{roleGuidance}</span>
                    )}
                  </div>
                  {(actionError || actionMessage) && (
                    <p
                      className={cn(
                        "mt-3 text-xs",
                        actionError ? "text-red-400" : "text-emerald-400"
                      )}
                    >
                      {actionError || actionMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredSettlements.length === 0 && (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg">
            <Activity className="h-8 w-8 text-zinc-600 mx-auto mb-3 opacity-50" />
            <p className="text-zinc-400 text-sm font-medium">
              {settlements.length === 0 ? "No settlements yet" : "No settlements match this filter"}
            </p>
            {settlements.length === 0 && (
              <p className="mt-1 text-xs text-zinc-600">
                Create a task, then fund escrow to start the proof-to-payment lifecycle.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineNode({
  icon: Icon,
  label,
  count,
  active,
  color,
  glow,
  pulse,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  color: "zinc" | "blue" | "amber" | "emerald";
  glow?: boolean;
  pulse?: boolean;
}) {
  const colorMap = {
    zinc: "bg-zinc-800 text-zinc-400 border-zinc-700",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/40",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/40",
  };
  
  return (
    <div className="flex flex-col items-center relative z-10 mb-8 md:mb-0">
      <div className={cn(
        "h-14 w-14 rounded-full flex items-center justify-center border-2 transition-all duration-500",
        active ? colorMap[color as keyof typeof colorMap] : "bg-zinc-900 text-zinc-600 border-zinc-800",
        glow && active && `shadow-[0_0_20px_rgba(var(--color-${color}),0.4)]`,
        pulse && active && "animate-pulse"
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-3 text-center">
        <div className={cn("text-sm font-semibold", active ? "text-white" : "text-zinc-500")}>{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{count} tasks</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  const colorMap = {
    emerald: "text-emerald-400",
    amber: "text-amber-500",
    blue: "text-blue-400",
    red: "text-red-400",
  };
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={cn("text-2xl font-mono mt-2", colorMap[color as keyof typeof colorMap])}>{value}</span>
    </div>
  );
}

function FilterTab({ label, active, onClick, color = "amber" }: { label: string, active: boolean, onClick: () => void, color?: string }) {
  const activeColors = {
    amber: "text-amber-500 border-amber-500",
    emerald: "text-emerald-400 border-emerald-400",
    red: "text-red-400 border-red-400",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
        active ? activeColors[color as keyof typeof activeColors] : "text-zinc-400 border-transparent hover:text-zinc-200"
      )}
    >
      {label}
    </button>
  );
}

function MiniFlowNode({ label, time, completed, isLast, status }: { label: string, time?: string, completed: boolean, isLast?: boolean, status?: string }) {
  let icon = <div className="h-2 w-2 rounded-full bg-zinc-600" />;
  let color = "text-zinc-500";
  
  if (completed) {
    if (status === "failed") {
      icon = <AlertCircle className="h-4 w-4 text-red-500" />;
      color = "text-red-400";
    } else {
      icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      color = "text-zinc-200";
    }
  }

  return (
    <div className="flex gap-3 relative z-10">
      <div className="mt-1 flex-shrink-0 w-4 h-4 flex items-center justify-center bg-zinc-950 rounded-full">
        {icon}
      </div>
      <div className={cn("pb-4", isLast && "pb-0")}>
        <div className={cn("text-sm font-medium", color)}>{label}</div>
        {time && <div className="text-xs text-zinc-500 mt-0.5">{time}</div>}
        {status === "failed" && <div className="text-xs text-red-400 mt-0.5">Verification criteria not met</div>}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
