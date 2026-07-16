"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileJson,
  Loader2,
  Lock,
  Receipt,
} from "lucide-react";
import { formatUSDC } from "@/lib/utils";

type UnlockPayload = {
  content?: {
    title: string;
    description: string;
    body: string;
    creatorName: string;
    source: string;
    sourceUrl: string | null;
  };
  paymentId?: string;
  access?: {
    amount?: number;
    creatorNetAmount?: number;
    platformFee?: number;
    accessedAt?: string;
  };
  agentPayment?: {
    transaction?: string;
    amount?: string;
    payTo?: string;
    gatewayDeposit?: {
      amount?: string;
      depositTxHash?: string;
    } | null;
  };
};

type ResourceUnlockPanelProps = {
  contentId: string;
  title: string;
  price: number;
  creatorReceives: number;
  platformFee: number;
};

export function ResourceUnlockPanel({
  contentId,
  title,
  price,
  creatorReceives,
  platformFee,
}: ResourceUnlockPanelProps) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "locked" | "paying" | "unlocked" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<UnlockPayload | null>(null);
  const [copied, setCopied] = useState("");

  const accessUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/api/creator-content/${contentId}/access`;
    }
    return `${window.location.origin}/api/creator-content/${contentId}/access`;
  }, [contentId]);

  async function requestAccess() {
    setStatus("checking");
    setMessage("Checking whether this resource is already unlocked...");
    setPayload(null);

    try {
      const response = await fetch(accessUrl, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 402) {
        setStatus("locked");
        setMessage("This resource is locked. Pay to unlock the content.");
        return;
      }
      if (!response.ok) {
        throw new Error("Access check failed.");
      }
      setPayload(data);
      setStatus("unlocked");
      setMessage("This resource is unlocked.");
    } catch {
      setStatus("error");
      setMessage("We could not check access right now. Please try again.");
    }
  }

  async function payAndUnlock() {
    setStatus("paying");
    setMessage("Processing payment and unlocking this resource...");

    try {
      const response = await fetch("/api/agent/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const data = (await response.json()) as UnlockPayload & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Payment failed.");
      }
      setPayload(data);
      setStatus("unlocked");
      setMessage("Payment complete. The resource is unlocked.");
    } catch {
      setStatus("error");
      setMessage(
        "Payment could not be completed. Check the buyer wallet funding and try again."
      );
    }
  }

  async function copyAccessUrl() {
    await navigator.clipboard.writeText(accessUrl);
    setCopied("url");
    window.setTimeout(() => setCopied(""), 1400);
  }

  async function copyReceipt() {
    if (!payload) return;
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied("receipt");
    window.setTimeout(() => setCopied(""), 1400);
  }

  function downloadJson() {
    if (!payload) return;
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const unlocked = status === "unlocked" && payload?.content;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-600">Price</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-amber-300">
            {formatUSDC(price)}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Creator receives {formatUSDC(creatorReceives)}. ProoVra fee{" "}
            {formatUSDC(platformFee)}.
          </p>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-3">
          {unlocked ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          ) : (
            <Lock className="h-5 w-5 text-amber-300" />
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={requestAccess}
          disabled={status === "checking" || status === "paying"}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:text-zinc-600"
        >
          {status === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Request Access
        </button>
        <button
          type="button"
          onClick={payAndUnlock}
          disabled={status === "checking" || status === "paying"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          {status === "paying" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          Pay & Unlock
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl border px-3 py-3 text-sm ${
            status === "unlocked"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : status === "error"
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-amber-500/20 bg-amber-500/10 text-amber-200"
          }`}
        >
          {message}
        </div>
      )}

      {unlocked && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <p className="text-sm font-semibold text-zinc-100">View Content</p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
              {payload.content?.body}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={downloadJson}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
            >
              <Download className="h-4 w-4" />
              Download JSON
            </button>
            <button
              type="button"
              onClick={copyAccessUrl}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
            >
              <Copy className="h-4 w-4" />
              {copied === "url" ? "Copied" : "Copy Access URL"}
            </button>
            <button
              type="button"
              onClick={copyReceipt}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
            >
              <Receipt className="h-4 w-4" />
              {copied === "receipt" ? "Copied" : "View Receipt"}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileJson className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-semibold text-zinc-100">Receipt</p>
            </div>
            <div className="space-y-1 break-all font-mono text-xs leading-5 text-zinc-500">
              <p>payment: {payload.paymentId ?? "confirmed"}</p>
              {payload.agentPayment?.transaction && (
                <p>transaction: {payload.agentPayment.transaction}</p>
              )}
              <p>gross: {formatUSDC(payload.access?.amount ?? price)}</p>
              <p>
                creator net:{" "}
                {formatUSDC(payload.access?.creatorNetAmount ?? creatorReceives)}
              </p>
              <p>
                proovra fee: {formatUSDC(payload.access?.platformFee ?? platformFee)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
