"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { 
  Play, 
  ShieldX, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Upload, 
  Activity,
  CheckCircle2,
  RefreshCw,
  Zap,
  Receipt
} from "lucide-react";
import type { Agent, Settlement, Task } from "@/lib/mock-data";
import { formatUSDC } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ComparisonColor = "zinc" | "amber" | "emerald" | "red";

export default function DemoPage() {
  const [demoStep, setDemoStep] = useState(0);
  const [proofHash, setProofHash] = useState("");
  const [txHash, setTxHash] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [currentSettlement, setCurrentSettlement] = useState<Settlement | null>(null);
  const { data } = useApi<{ agents: Agent[] }>("/api/agents");
  const { data: taskData } = useApi<{ tasks: Task[] }>("/api/tasks");
  const { data: settlementData } = useApi<{ settlements: Settlement[] }>("/api/settlements");
  const requesterAgent = data?.agents?.find(
    (agent) => agent.type === "requester" || agent.type === "both"
  );
  const providerAgent = data?.agents?.find(
    (agent) => agent.type === "provider" || agent.type === "both"
  );
  const latestTask = taskData?.tasks?.[0] ?? null;
  const latestSettlement = settlementData?.settlements?.[0] ?? null;

  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = () => {
    if (demoStep >= 7 || isProcessing) return;
    
    setIsProcessing(true);
    const nextStep = demoStep + 1;

    if (nextStep === 1) {
      setCurrentTask(latestTask);
      setCurrentSettlement(latestSettlement);
    }
    if (nextStep === 4) {
      setProofHash(
        latestSettlement?.proofHash ||
          "Proof hash is generated from submitted proof content"
      );
    }
    if (nextStep === 6) {
      setCurrentSettlement(latestSettlement);
      setTxHash(
        latestSettlement?.releaseTxHash ||
          latestSettlement?.escrowTxHash ||
          "Wallet-signed Arc transaction evidence appears after live execution"
      );
    }
    if (nextStep === 7) {
      setReceiptId(latestSettlement?.receiptId || "Generated after release");
    }

    setDemoStep(nextStep);
    window.setTimeout(() => setIsProcessing(false), 250);
  };

  const handleReset = () => {
    setDemoStep(0);
    setProofHash("");
    setTxHash("");
    setReceiptId("");
    setCurrentTask(null);
    setCurrentSettlement(null);
  };

  return (
    <div className="space-y-12 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Play className="h-6 w-6 text-amber-500" />
            Interactive Demo
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Experience proof-based settlement in action</p>
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Without ProoVra */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-red-500/10 p-2 rounded-full">
            <ShieldX className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-6">Without ProoVra</h3>
          
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-red-500/20 before:z-0">
            <ComparisonStep label="Agent A hires Agent B" active />
            <ComparisonStep label="Requester pays USDC immediately" active />
            <ComparisonStep label="Provider may fail to deliver" active color="red" />
            <ComparisonStep label="Funds are lost" active color="red" isLast />
          </div>

          <div className="mt-8 pt-6 border-t border-red-500/20 flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Result</span>
            <span className="text-red-400 font-bold tracking-tight">Pay → Risk</span>
          </div>
        </div>

        {/* With ProoVra */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-emerald-500/10 p-2 rounded-full">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-6">With ProoVra</h3>
          
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-amber-500/50 before:to-emerald-500/50 before:z-0">
            <ComparisonStep label="Requester creates an open task" active color="amber" />
            <ComparisonStep label="Provider accepts the task" active color="amber" />
            <ComparisonStep label="Requester funds USDC escrow" active color="amber" />
            <ComparisonStep label="Provider submits proof" active color="amber" />
            <ComparisonStep label="Requester verifies proof" active color="amber" />
            <ComparisonStep label="Requester releases payment to provider" active color="emerald" />
            <ComparisonStep label="Receipt generated" active color="emerald" isLast />
          </div>

          <div className="mt-8 pt-6 border-t border-amber-500/20 flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Result</span>
            <span className="text-emerald-400 font-bold tracking-tight">Proof → Settlement → Trust</span>
          </div>
        </div>
      </div>

      {/* Interactive Settlement Demo */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-zinc-300">Product Settlement Walkthrough</div>
            <div className="bg-zinc-800 px-2 py-0.5 rounded text-xs font-mono text-zinc-400">Step {demoStep}/7</div>
          </div>
          <div className="flex gap-2">
            {demoStep > 0 && (
              <button 
                onClick={handleReset}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Reset"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={demoStep === 7}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all",
                demoStep === 7 
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed" 
                  : "bg-amber-500 hover:bg-amber-400 text-amber-950"
              )}
            >
              {demoStep === 0 ? "Start Demo" : demoStep === 7 ? "Complete" : "Next Step"}
              {demoStep < 7 && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="p-8 md:p-12 relative min-h-[400px] flex flex-col items-center justify-center">
          
          {/* Main Visual Area */}
          <div className="flex items-center justify-center gap-8 md:gap-24 w-full relative z-10">
            
            {/* Requester Agent */}
            <div className={cn("flex flex-col items-center transition-all duration-500", demoStep >= 1 ? "opacity-100" : "opacity-50")}>
              <div className="h-16 w-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-3xl mb-3 shadow-lg">
                {requesterAgent?.avatar ?? "RA"}
              </div>
              <div className="text-center">
                <div className="font-semibold text-white">
                  {requesterAgent?.name ?? "Requester Agent"}
                </div>
                <div className="text-xs text-zinc-500">Requester</div>
              </div>
            </div>

            {/* Central Escrow / ProoVra Engine */}
            <div className="relative flex flex-col items-center justify-center">
              
              {/* Status Text Above */}
              <div className="absolute -top-12 w-48 text-center">
                {demoStep === 0 && <span className="text-sm text-zinc-500">Ready</span>}
                {demoStep === 1 && <span className="text-sm font-medium text-zinc-300">Open Task Created</span>}
                {demoStep === 2 && <span className="text-sm font-medium text-blue-400">Provider Accepted</span>}
                {demoStep === 3 && <span className="text-sm font-medium text-amber-500 animate-pulse">Escrow Funded</span>}
                {demoStep === 4 && <span className="text-sm font-medium text-blue-400">Proof Submitted</span>}
                {demoStep === 5 && <span className="text-sm font-medium text-amber-400">Proof Verified</span>}
                {demoStep === 6 && <span className="text-sm font-medium text-emerald-400 animate-pulse">Payment Released</span>}
                {demoStep === 7 && <span className="text-sm font-medium text-emerald-500">Receipt Generated</span>}
              </div>

              {/* The Engine UI */}
              <div className={cn(
                "h-24 w-24 rounded-full flex items-center justify-center border-4 transition-all duration-700 z-20 bg-zinc-950",
                demoStep === 0 ? "border-zinc-800 text-zinc-600" : "",
                demoStep === 1 ? "border-zinc-600 text-zinc-300" : "",
                demoStep === 2 ? "border-blue-500 text-blue-500" : "",
                demoStep === 3 ? "border-amber-500 text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]" : "",
                demoStep === 4 ? "border-blue-500 text-blue-500" : "",
                demoStep === 5 ? "border-amber-400 text-amber-400 animate-spin-slow shadow-[0_0_20px_rgba(251,191,36,0.3)]" : "",
                demoStep >= 6 ? "border-emerald-500 text-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]" : ""
              )}>
                {demoStep === 0 && <ShieldCheck className="h-10 w-10" />}
                {demoStep === 1 && <Play className="h-10 w-10" />}
                {demoStep === 2 && <CheckCircle2 className="h-10 w-10" />}
                {demoStep === 3 && <Lock className="h-10 w-10" />}
                {demoStep === 4 && <Upload className="h-10 w-10" />}
                {demoStep === 5 && <Activity className="h-10 w-10" />}
                {demoStep >= 6 && <CheckCircle2 className="h-10 w-10" />}
              </div>

              {/* Dynamic Connection Lines */}
              <div className="absolute top-1/2 left-[-100px] md:left-[-150px] right-[-100px] md:right-[-150px] h-1 -translate-y-1/2 z-10 flex">
                <div className={cn("h-full w-1/2 transition-colors duration-500", demoStep >= 3 ? "bg-amber-500/50" : "bg-zinc-800")}></div>
                <div className={cn("h-full w-1/2 transition-colors duration-500", demoStep >= 6 ? "bg-emerald-500/50" : "bg-zinc-800")}></div>
              </div>

              {/* USDC Flow Animation */}
              {demoStep === 3 && (
                <div className="absolute top-1/2 left-[-60px] md:left-[-100px] h-4 w-4 -translate-y-1/2 rounded-full bg-amber-500 shadow-[0_0_10px_#f59e0b] animate-slide-right z-30"></div>
              )}
              {demoStep === 6 && (
                <div className="absolute top-1/2 right-[-60px] md:right-[-100px] h-4 w-4 -translate-y-1/2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-slide-right z-30"></div>
              )}

            </div>

            {/* Provider Agent */}
            <div className={cn("flex flex-col items-center transition-all duration-500", demoStep >= 2 ? "opacity-100" : "opacity-50")}>
              <div className={cn(
                "h-16 w-16 rounded-2xl border flex items-center justify-center text-3xl mb-3 shadow-lg transition-colors duration-500",
                demoStep >= 6 ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : "bg-zinc-800 border-zinc-700"
              )}>
                {providerAgent?.avatar ?? "PB"}
              </div>
              <div className="text-center">
                <div className="font-semibold text-white flex items-center gap-2">
                  {providerAgent?.name ?? "Provider Agent"}
                  {providerAgent?.reputationScore && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      demoStep >= 6 ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                    )}>
                      REP {Math.round(providerAgent.reputationScore)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">Provider</div>
              </div>
            </div>

          </div>

          {/* Details Panel below */}
          <div className="mt-16 w-full max-w-2xl bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-6 min-h-[160px]">
            {demoStep === 0 && (
              <div className="text-center text-zinc-500 h-full flex items-center justify-center">
                Click Start Demo to walk through the contributor proof-to-payment sidecar flow. Live settlement execution happens from the Tasks and Settlement pages with a connected Arc Testnet wallet.
              </div>
            )}
            
            {demoStep >= 1 && (
              <div className="space-y-4 animate-fade-in-up">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-sm text-zinc-400">Task</span>
                  <span className="text-sm font-medium text-white">
                    {currentTask?.title ?? "Create proof-gated task"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-sm text-zinc-400">Escrow Amount</span>
                  <span className="font-mono text-amber-500">
                    {formatUSDC(currentTask?.amount ?? currentSettlement?.amount ?? 0.000001)}
                  </span>
                </div>
              </div>
            )}

            {demoStep >= 4 && (
              <div className="space-y-4 mt-4 animate-fade-in-up">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-sm text-zinc-400">Proof Hash</span>
                  <span className="font-mono text-xs text-zinc-300 bg-zinc-900 px-2 py-1 rounded">
                    {proofHash.startsWith("0x") ? `${proofHash.substring(0, 32)}...` : proofHash}
                  </span>
                </div>
              </div>
            )}

            {demoStep >= 6 && (
              <div className="space-y-4 mt-4 animate-fade-in-up">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-sm text-zinc-400">Settlement Time</span>
                  <span className="font-mono text-emerald-400 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {currentSettlement?.settlementTime
                      ? `${Math.round(currentSettlement.settlementTime)}ms`
                      : "Recorded"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-sm text-zinc-400">Settlement Evidence</span>
                  <span className="font-mono text-xs text-emerald-500/80 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">{txHash}</span>
                </div>
                {demoStep === 7 && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-zinc-400">Receipt Generated</span>
                    <span className="font-mono text-sm font-medium text-white flex items-center gap-1.5 bg-zinc-800 px-3 py-1 rounded-md border border-zinc-700">
                      <Receipt className="h-4 w-4 text-amber-500" />
                      {receiptId}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Demo Narrative Text */}
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-6 max-w-3xl">
        <h4 className="text-sm font-semibold text-white mb-2 uppercase tracking-wider">The Story</h4>
        <p className="text-zinc-400 text-sm leading-relaxed">
          A maintainer brings an existing issue or work item into ProoVra. A contributor accepts the payout task,
          completes the work in its original community, and submits a PR link, commit hash, file, or other proof.
          <strong className="text-amber-500 font-medium"> Payment moves only after the maintainer verifies completion.</strong>
          <br /><br />
          The walkthrough shows ProoVra as a sidecar rather than a new marketplace: the upstream community remains where
          work and review happen, while ProoVra handles contributor acceptance, Arc Testnet escrow, proof records,
          maintainer approval, payment release, and the persisted settlement receipt.
        </p>
      </div>
    </div>
  );
}

function ComparisonStep({
  label,
  active,
  color = "zinc",
  isLast = false,
}: {
  label: string;
  active: boolean;
  color?: ComparisonColor;
  isLast?: boolean;
}) {
  const colorMap = {
    zinc: "bg-zinc-800 border-zinc-700",
    amber: "bg-amber-500/20 border-amber-500/40 text-amber-500",
    emerald: "bg-emerald-500/20 border-emerald-500/40 text-emerald-500",
    red: "bg-red-500/20 border-red-500/40 text-red-500",
  };

  return (
    <div className="flex items-center gap-3 relative z-10">
      <div className={cn(
        "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border text-[10px]",
        active ? colorMap[color as keyof typeof colorMap] : "bg-zinc-900 border-zinc-800 text-zinc-600"
      )}>
        {color === "emerald" ? <CheckCircle2 className="h-3 w-3" /> : color === "red" ? <ShieldX className="h-3 w-3" /> : "•"}
      </div>
      <div className={cn("text-sm", active ? "text-zinc-200 font-medium" : "text-zinc-600", isLast && "pb-0")}>
        {label}
      </div>
    </div>
  );
}
