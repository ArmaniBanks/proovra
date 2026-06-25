"use client";

import type { MouseEvent, ReactNode, SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import {
  ArrowDown,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Receipt as ReceiptIcon,
  Share2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { Agent, Receipt, Task } from "@/lib/mock-data";
import { getProofFileUrl } from "@/lib/proof-file-url";
import { formatUSDC, formatTimestamp, truncateAddress } from "@/lib/utils";

export default function ReceiptsPage() {
  const searchParams = useSearchParams();
  const handledReceiptParam = useRef<string | null>(null);
  const { data, loading, error } = useApi<{
    receipts: Receipt[];
    agentsById: Record<string, Agent>;
    tasksById: Record<string, Task>;
    dataSource: {
      hasSampleRecords: boolean;
    };
  }>("/api/receipts");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const receipts = useMemo(() => data?.receipts ?? [], [data?.receipts]);
  const agentsById = data?.agentsById ?? {};
  const tasksById = data?.tasksById ?? {};

  useEffect(() => {
    const receiptId = searchParams.get("receipt");
    if (!receiptId || receipts.length === 0) return;
    if (!receipts.some((receipt) => receipt.id === receiptId)) return;
    if (handledReceiptParam.current === receiptId) return;
    handledReceiptParam.current = receiptId;

    window.requestAnimationFrame(() => {
      setExpandedId(receiptId);
      document.getElementById(`receipt-${receiptId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [receipts, searchParams]);

  if (error) return <div className="p-8 text-red-500 border border-red-500/20 bg-red-500/10 rounded-md m-4">Error loading data: {error.message}</div>;
  if (!data && loading) return <div className="animate-pulse p-8 text-zinc-500">Loading...</div>;

  function escapeHtml(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function getLogoDataUrl() {
    try {
      const response = await fetch("/proovra-logo.png");
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return `${window.location.origin}/proovra-logo.png`;
    }
  }

  async function downloadReceipt(receipt: Receipt, task?: Task, requester?: Agent, provider?: Agent) {
    const logoSrc = await getLogoDataUrl();
    const proofFileUrl = receipt.proofFile
      ? getProofFileUrl(receipt.proofFile, window.location.origin)
      : "";
    const receiptHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ProoVra Receipt ${escapeHtml(receipt.id)}</title>
  <style>
    body { margin: 0; background: #050506; color: #f4f4f5; font-family: Inter, Arial, sans-serif; }
    .page { max-width: 760px; margin: 32px auto; padding: 32px; border: 1px solid #27272a; background: #09090b; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 1px solid #27272a; padding-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 20px; }
    .logo { width: 36px; height: 36px; object-fit: contain; border-radius: 8px; background: #000; display: block; }
    .muted { color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .mono { font-family: Consolas, Menlo, monospace; }
    .accent { color: #f5b400; }
    .green { color: #00d68f; }
    .amount { font-size: 36px; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; gap: 24px; padding: 12px 0; border-bottom: 1px solid #27272a; }
    .box { margin: 24px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; border: 1px solid #27272a; background: #121216; }
    .code { margin-top: 6px; padding: 10px; border: 1px solid #27272a; background: #18181b; color: #d4d4d8; word-break: break-all; font-size: 12px; }
    a { color: #f5b400; }
    .footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <div class="brand">
        <img class="logo" src="${escapeHtml(logoSrc)}" alt="ProoVra" />
        <span>ProoVra</span>
      </div>
      <div style="text-align:right">
        <div class="muted">Settlement Receipt</div>
        <div class="mono accent" style="font-size:20px">${escapeHtml(receipt.id)}</div>
      </div>
    </section>
    <section style="margin-top:28px; display:flex; justify-content:space-between; align-items:flex-end">
      <div>
        <div class="muted">Settlement Amount</div>
        <div class="mono amount">${escapeHtml(formatUSDC(receipt.amount))}</div>
      </div>
      <div style="text-align:right">
        <div class="muted">Date</div>
        <div class="mono">${escapeHtml(formatTimestamp(receipt.createdAt))}</div>
      </div>
    </section>
    <section class="box">
      <div>
        <div class="muted">From (Requester)</div>
        <strong>${escapeHtml(requester?.name)}</strong>
        <div class="mono" style="color:#a1a1aa;font-size:12px">${escapeHtml(requester?.walletAddress)}</div>
      </div>
      <div>
        <div class="muted">To (Provider)</div>
        <strong>${escapeHtml(provider?.name)}</strong>
        <div class="mono" style="color:#a1a1aa;font-size:12px">${escapeHtml(provider?.walletAddress)}</div>
      </div>
    </section>
    <div class="row"><span>Task Reference</span><strong>${escapeHtml(task?.title)}</strong></div>
    <div class="row"><span>Network</span><strong>Arc Testnet</strong></div>
    <div class="row"><span>Payment Recipient</span><span class="mono">${escapeHtml(provider?.walletAddress)}</span></div>
    <div class="row"><span>Block Number</span><span class="mono">${escapeHtml(receipt.blockNumber)}</span></div>
    <div class="row"><span>Settlement Time</span><span class="mono green">${escapeHtml(Math.round(receipt.settlementTime))}ms</span></div>
    <div class="row"><span>Proof Verified</span><span class="mono">${escapeHtml(receipt.verificationTimestamp ? formatTimestamp(receipt.verificationTimestamp) : "Not recorded")}</span></div>
    <section style="margin-top:20px">
      <div class="muted">Proof Hash</div>
      <div class="code mono">${escapeHtml(receipt.proofHash)}</div>
    </section>
    <section style="margin-top:16px">
      <div class="muted">Proof Reference</div>
      <div class="code mono">${escapeHtml(receipt.proofUrl || receipt.proofText || "")}</div>
    </section>
    ${receipt.proofFile ? `<section style="margin-top:16px">
      <div class="muted">Uploaded Proof File</div>
      <div class="code mono">
        ${escapeHtml(receipt.proofFile.fileName)}<br />
        ${escapeHtml(receipt.proofFile.fileType)} · ${escapeHtml(receipt.proofFile.fileSize)} bytes<br />
        Uploaded: ${escapeHtml(formatTimestamp(receipt.proofFile.uploadedAt))}<br />
        Path: ${escapeHtml(proofFileUrl)}<br />
        ${receipt.proofFile.fileHash ? `File hash: ${escapeHtml(receipt.proofFile.fileHash)}` : ""}
      </div>
      <a href="${escapeHtml(proofFileUrl)}">${escapeHtml(proofFileUrl)}</a>
    </section>` : ""}
    <section style="margin-top:16px">
      <div class="muted">Escrow Transaction Hash</div>
      <div class="code mono">${escapeHtml(receipt.escrowTxHash)}</div>
      ${receipt.escrowExplorerLink ? `<a href="${escapeHtml(receipt.escrowExplorerLink)}">${escapeHtml(receipt.escrowExplorerLink)}</a>` : ""}
    </section>
    <section style="margin-top:16px">
      <div class="muted">Release Transaction Hash</div>
      <div class="code mono">${escapeHtml(receipt.releaseTxHash ?? receipt.arcTxHash)}</div>
      ${(receipt.releaseExplorerLink ?? receipt.explorerLink) ? `<a href="${escapeHtml(receipt.releaseExplorerLink ?? receipt.explorerLink)}">${escapeHtml(receipt.releaseExplorerLink ?? receipt.explorerLink)}</a>` : ""}
    </section>
    <footer class="footer">
      <strong class="green">Cryptographically Verified</strong>
      <span class="mono">${escapeHtml(receipt.settlementId)}</span>
    </footer>
  </main>
</body>
</html>`;
    const blob = new Blob([receiptHtml], {
      type: "text/html",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${receipt.id}-proovra-receipt.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function copyToClipboard(value?: string): Promise<boolean> {
    if (!value) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // Fall through to textarea fallback below.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }

  function copyReceiptLink(receiptId: string) {
    return copyToClipboard(`${window.location.origin}/receipts?receipt=${encodeURIComponent(receiptId)}`);
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <ReceiptIcon className="h-6 w-6 text-amber-500" />
            Settlement Receipts
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Proof-of-delivery records generated from persisted settlements</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-medium text-emerald-400">{receipts.length} Verified</span>
        </div>
      </div>

      {/* Receipts Grid */}
      <div className="grid grid-cols-1 gap-4">
        {receipts.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center">
            <ReceiptIcon className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No receipts generated yet.</p>
            <p className="mt-1 text-xs text-zinc-600">
              A receipt is created only after verified proof releases payment.
            </p>
          </div>
        )}
        {receipts.map((receipt) => {
          const task = tasksById[receipt.taskId];
          const requester = agentsById[receipt.requesterId];
          const provider = agentsById[receipt.providerId];
          const isExpanded = expandedId === receipt.id;
          const proofFileUrl = receipt.proofFile ? getProofFileUrl(receipt.proofFile) : "";
          
          return (
            <div 
              id={`receipt-${receipt.id}`}
              key={receipt.id}
              className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden border-l-4 border-l-emerald-500/50 hover:border-zinc-700 transition-colors"
            >
              <div 
                className="p-5 cursor-pointer flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
              >
                {/* Left: Basic Info */}
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-500 font-bold tracking-wide">{receipt.id}</span>
                      <span className="text-zinc-600 text-sm">•</span>
                      <span className="font-mono text-zinc-500 text-xs">{receipt.settlementId}</span>
                    </div>
                    <div className="text-sm text-zinc-300 mt-1 line-clamp-1">{task?.title}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
                      <span>{requester?.name}</span>
                      <span className="text-zinc-600">→</span>
                      <span>{provider?.name}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Technical Info */}
                <div className="flex flex-col md:items-end w-full md:w-auto mt-2 md:mt-0 gap-2 md:gap-0">
                  <div className="font-mono text-xl text-white">{formatUSDC(receipt.amount)}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                      <ZapIcon className="h-3 w-3" />
                      {Math.round(receipt.settlementTime)}ms
                    </div>
                    <div className="text-xs text-zinc-500 font-mono hidden sm:block">
                      {formatTimestamp(receipt.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Receipt Detail */}
              {isExpanded && (
                <div className="border-t border-zinc-800/50 bg-[#0c0c0f] p-4 sm:p-6 lg:p-8">
                  <ReceiptDetail
                    receipt={receipt}
                    task={task}
                    requester={requester}
                    provider={provider}
                    proofFileUrl={proofFileUrl}
                    onCopy={copyToClipboard}
                    onCopyLink={copyReceiptLink}
                    onDownload={downloadReceipt}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReceiptDetail({
  receipt,
  task,
  requester,
  provider,
  proofFileUrl,
  onCopy,
  onCopyLink,
  onDownload,
}: {
  receipt: Receipt;
  task?: Task;
  requester?: Agent;
  provider?: Agent;
  proofFileUrl: string;
  onCopy: (value?: string) => Promise<boolean>;
  onCopyLink: (receiptId: string) => Promise<boolean>;
  onDownload: (receipt: Receipt, task?: Task, requester?: Agent, provider?: Agent) => void;
}) {
  const settlementTimestamp = receipt.settlementTimestamp ?? receipt.createdAt;
  const releaseHash = receipt.releaseTxHash ?? receipt.arcTxHash;
  const releaseLink = receipt.releaseExplorerLink ?? receipt.explorerLink;
  const shareText = "ProoVra settlement receipt: verified proof authorized payment.";
  const receiptUrl = `${window.location.origin}/receipts?receipt=${encodeURIComponent(receipt.id)}`;
  const shareMenuRef = useRef<HTMLDivElement | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<"copy" | "copy-failed" | "link-copied" | null>(null);

  function showActionFeedback(type: NonNullable<typeof actionFeedback>) {
    setActionFeedback(type);
    window.setTimeout(() => setActionFeedback(null), 2000);
  }

  useEffect(() => {
    if (!shareMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!shareMenuRef.current?.contains(event.target as Node)) {
        setShareMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [shareMenuOpen]);

  function openShareTarget(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setShareMenuOpen(false);
  }

  async function copyShareLink() {
    showActionFeedback((await onCopy(receiptUrl)) ? "link-copied" : "copy-failed");
    setShareMenuOpen(false);
  }

  const shareTargets = [
    {
      label: "WhatsApp",
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${receiptUrl}`)}`,
    },
    {
      label: "Telegram",
      url: `https://t.me/share/url?url=${encodeURIComponent(receiptUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      label: "X / Twitter",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(receiptUrl)}`,
    },
    {
      label: "Email",
      url: `mailto:?subject=${encodeURIComponent("ProoVra settlement receipt")}&body=${encodeURIComponent(
        `${shareText}\n\n${receiptUrl}`
      )}`,
    },
  ];

  return (
    <div className="mx-auto max-w-[820px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      <section className="border-b border-zinc-800 bg-zinc-950 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Payment Released
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Settlement Completed
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Proof was submitted, reviewed, and accepted before payment release on Arc Testnet.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-amber-500/20 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/proovra-logo.png" alt="ProoVra" className="block h-7 w-7 object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">ProoVra</div>
              <div className="text-xs text-zinc-500">Settlement Receipt</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 p-5 sm:p-7">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
          <SectionTitle icon={<ReceiptIcon className="h-4 w-4 text-amber-500" />}>Settlement Summary</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryItem label="Settlement ID" value={receipt.settlementId} mono />
            <SummaryItem label="Task Title" value={task?.title ?? "Untitled task"} />
            <SummaryItem label="Amount" value={formatUSDC(receipt.amount)} strong />
            <SummaryItem label="Currency" value="USDC" />
            <SummaryItem label="Settlement Status" value="Released" status />
            <SummaryItem label="Timestamp" value={formatTimestamp(settlementTimestamp)} mono />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ParticipantCard title="Requester" name={requester?.name ?? "Requester Agent"} walletAddress={requester?.walletAddress} />
          <ParticipantCard title="Provider" name={provider?.name ?? "Provider Agent"} walletAddress={provider?.walletAddress} />
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionTitle icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}>Proof Verification</SectionTitle>
              <p className="mt-1 text-xs text-zinc-500">Proof was accepted before payment.</p>
            </div>
            <div className="w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              Verified
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <VerificationState label="Proof Submitted" />
            <VerificationState label="Proof Verified" />
            <VerificationState
              label="Verification Timestamp"
              detail={receipt.verificationTimestamp ? formatTimestamp(receipt.verificationTimestamp) : "Not recorded"}
            />
          </div>
          <div className="mt-5 grid gap-3">
            <EvidenceBlock label="Proof Hash" value={receipt.proofHash} onCopy={() => onCopy(receipt.proofHash)} />
            {(receipt.proofUrl || receipt.proofText) && (
              <EvidenceBlock
                label={receipt.proofUrl ? "Proof URL" : "Proof Text"}
                value={receipt.proofUrl || receipt.proofText || ""}
                href={receipt.proofUrl}
                onCopy={() => onCopy(receipt.proofUrl || receipt.proofText)}
              />
            )}
            {receipt.proofFile && (
              <EvidenceBlock
                label="Uploaded Proof File"
                value={`${receipt.proofFile.fileName} - ${receipt.proofFile.fileType} - ${receipt.proofFile.fileSize} bytes`}
                detail={[
                  `Uploaded ${formatTimestamp(receipt.proofFile.uploadedAt)}`,
                  receipt.proofFile.fileHash ? `File hash ${receipt.proofFile.fileHash}` : "",
                ]
                  .filter(Boolean)
                  .join(" - ")}
                href={proofFileUrl}
                onCopy={() => onCopy(proofFileUrl)}
              />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
          <SectionTitle icon={<Wallet className="h-4 w-4 text-amber-500" />}>Transaction Evidence</SectionTitle>
          <div className="mt-4 grid gap-3">
            <EvidenceBlock
              label="Escrow Transaction Hash"
              value={receipt.escrowTxHash ?? "Not recorded"}
              href={receipt.escrowExplorerLink}
              onCopy={() => onCopy(receipt.escrowTxHash)}
            />
            <EvidenceBlock
              label="Release Transaction Hash"
              value={releaseHash}
              href={releaseLink}
              onCopy={() => onCopy(releaseHash)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryItem label="Network" value="Arc Testnet" />
              <SummaryItem label="Settlement Timestamp" value={formatTimestamp(settlementTimestamp)} mono />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
          <SectionTitle icon={<FileText className="h-4 w-4 text-amber-500" />}>Settlement Timeline</SectionTitle>
          <div className="mt-5 grid gap-3 md:grid-cols-7">
            {[
              "Task Created",
              "Provider Accepted",
              "Escrow Funded",
              "Proof Submitted",
              "Proof Verified",
              "Payment Released",
              "Receipt Generated",
            ].map((item, index, items) => (
              <TimelineItem key={item} label={item} isLast={index === items.length - 1} />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
          <SectionTitle icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}>Receipt Integrity</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem label="Receipt ID" value={receipt.id} mono />
            <SummaryItem label="Generated" value={formatTimestamp(receipt.createdAt)} mono />
            <SummaryItem label="Settlement Reference" value={receipt.settlementId} mono />
            <SummaryItem label="Network" value="Arc Testnet" />
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium">Permanent verified settlement record</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionButton onClick={() => onDownload(receipt, task, requester, provider)}>
              <Download className="h-4 w-4" />
              Download Receipt
            </ActionButton>
            <ActionButton
              onClick={async () => {
                showActionFeedback((await onCopyLink(receipt.id)) ? "copy" : "copy-failed");
              }}
            >
              <Link2 className="h-4 w-4" />
              {actionFeedback === "copy"
                ? "Copied"
                : actionFeedback === "copy-failed"
                  ? "Copy Failed"
                  : "Copy Receipt Link"}
            </ActionButton>
            <div ref={shareMenuRef} className="relative">
              <ActionButton onClick={() => setShareMenuOpen((open) => !open)}>
                <Share2 className="h-4 w-4" />
                {actionFeedback === "link-copied" ? "Link Copied" : "Share Receipt"}
              </ActionButton>
              {shareMenuOpen && (
                <div
                  className="absolute bottom-full right-0 z-20 mb-2 w-48 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  {shareTargets.map((target) => (
                    <button
                      key={target.label}
                      type="button"
                      onClick={() => openShareTarget(target.url)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    >
                      {target.label}
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-600" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    Copy Link
                    <Copy className="h-3.5 w-3.5 text-zinc-600" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-white">
      {icon}
      {children}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  mono = false,
  strong = false,
  status = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  strong?: boolean;
  status?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={[
          "mt-1 break-words text-sm text-zinc-200",
          mono ? "font-mono" : "",
          strong ? "font-mono text-xl font-semibold text-white" : "",
          status ? "w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function ParticipantCard({ title, name, walletAddress }: { title: string; name: string; walletAddress?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{title}</div>
      <div className="mt-2 text-base font-semibold text-white">{name}</div>
      <div className="mt-2 break-all font-mono text-xs text-zinc-500">{walletAddress ?? "Not recorded"}</div>
      {walletAddress && <div className="mt-1 font-mono text-xs text-zinc-400">{truncateAddress(walletAddress)}</div>}
    </div>
  );
}

function VerificationState({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="flex items-center gap-2 text-sm text-zinc-200">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        {label}
      </div>
      {detail && <div className="mt-2 font-mono text-xs text-zinc-500">{detail}</div>}
    </div>
  );
}

function EvidenceBlock({
  label,
  value,
  detail,
  href,
  onCopy,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  onCopy?: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopyClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!(await onCopy?.())) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
        <div className="flex items-center gap-2">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="text-zinc-500 hover:text-amber-400"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {onCopy && (
            <button
              type="button"
              onClick={(event) => void handleCopyClick(event)}
              className="inline-flex items-center gap-1 text-zinc-500 hover:text-white"
              aria-label={`Copy ${label}`}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400">Copied</span>
                </>
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
      <div className="max-w-full overflow-hidden break-all font-mono text-xs leading-5 text-zinc-300">{value}</div>
      {detail && <div className="mt-2 break-all text-xs leading-5 text-zinc-500">{detail}</div>}
    </div>
  );
}

function TimelineItem({ label, isLast }: { label: string; isLast: boolean }) {
  return (
    <div className="flex items-center gap-3 md:flex-col md:items-start">
      <div className="flex items-center gap-3 md:w-full">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        {!isLast && <ArrowDown className="h-4 w-4 text-zinc-700 md:hidden" />}
        {!isLast && <div className="hidden h-px flex-1 bg-zinc-800 md:block" />}
      </div>
      <div className="text-sm font-medium text-zinc-200">{label}</div>
    </div>
  );
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void | Promise<void> }) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    void onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
    >
      {children}
    </button>
  );
}

// Custom zap icon for speed
function ZapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
