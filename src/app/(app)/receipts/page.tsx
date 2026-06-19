"use client";

import type { SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { Receipt as ReceiptIcon, ShieldCheck, Download, ExternalLink } from "lucide-react";
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
                <div className="border-t border-zinc-800/50 bg-[#0c0c0f] p-8">
                  <div className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded p-8 shadow-2xl relative overflow-hidden">
                    
                    {/* Background seal */}
                    <div className="absolute right-6 top-6 pointer-events-none opacity-[0.04]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/proovra-logo.png"
                        alt=""
                        className="block h-16 w-16 object-contain"
                      />
                    </div>

                    <div className="flex justify-between items-start mb-10 border-b border-zinc-800/50 pb-6">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-amber-500/20 bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/proovra-logo.png"
                            alt="ProoVra"
                            className="block h-5 w-5 object-contain"
                          />
                        </div>
                        <span className="font-semibold text-lg tracking-tight">ProoVra</span>
                      </div>
                      <div className="text-right">
                        <h2 className="text-zinc-500 uppercase tracking-widest text-xs font-semibold mb-1">Settlement Receipt</h2>
                        <div className="font-mono text-amber-500 text-lg">{receipt.id}</div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Settlement Amount</div>
                          <div className="font-mono text-3xl text-white">{formatUSDC(receipt.amount)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Date</div>
                          <div className="font-mono text-sm text-zinc-300">{formatTimestamp(receipt.createdAt)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 bg-zinc-900/50 p-4 rounded border border-zinc-800/50">
                        <div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">From (Requester)</div>
                          <div className="font-medium text-zinc-300">{requester?.name}</div>
                          <div className="font-mono text-xs text-zinc-500 mt-1">{truncateAddress(requester?.walletAddress || "")}</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">To (Provider)</div>
                          <div className="font-medium text-zinc-300">{provider?.name}</div>
                          <div className="font-mono text-xs text-zinc-500 mt-1">{truncateAddress(provider?.walletAddress || "")}</div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <div className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-2">
                          <span className="text-zinc-500">Task Reference</span>
                          <span className="text-zinc-300">{task?.title}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-2">
                          <span className="text-zinc-500">Network</span>
                          <span className="text-zinc-300">Arc Testnet</span>
                        </div>
                        <div className="flex justify-between gap-4 text-sm border-b border-zinc-800/50 pb-2">
                          <span className="text-zinc-500">Payment Recipient</span>
                          <span className="font-mono text-xs text-zinc-300 break-all text-right">
                            {provider?.walletAddress}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-2">
                          <span className="text-zinc-500">Block Number</span>
                          <span className="font-mono text-zinc-300">{receipt.blockNumber}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-2">
                          <span className="text-zinc-500">Settlement Time</span>
                          <span className="font-mono text-emerald-400">{Math.round(receipt.settlementTime)}ms</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-zinc-800/50 pb-2">
                          <span className="text-zinc-500">Proof Verified</span>
                          <span className="font-mono text-zinc-300">
                            {receipt.verificationTimestamp
                              ? formatTimestamp(receipt.verificationTimestamp)
                              : "Not recorded"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Proof Hash</div>
                        <div className="font-mono text-xs text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800 break-all">
                          {receipt.proofHash}
                        </div>
                      </div>

                      {(receipt.proofUrl || receipt.proofText) && (
                        <div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Proof Reference</div>
                          <div className="font-mono text-xs text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800 break-all">
                            {receipt.proofUrl || receipt.proofText}
                          </div>
                        </div>
                      )}

                      {receipt.proofFile && (
                        <div>
                          <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Uploaded Proof File</div>
                          <div className="space-y-1 font-mono text-xs text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800 break-all">
                            <a
                              href={getProofFileUrl(receipt.proofFile)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-sans font-medium text-amber-400 hover:text-amber-300"
                            >
                              {receipt.proofFile.fileName}
                            </a>
                            <div>{receipt.proofFile.fileType}</div>
                            <div>{receipt.proofFile.fileSize} bytes</div>
                            <div>Uploaded {formatTimestamp(receipt.proofFile.uploadedAt)}</div>
                            <div>{proofFileUrl}</div>
                            {receipt.proofFile.fileHash && <div>{receipt.proofFile.fileHash}</div>}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Escrow Transaction Hash</div>
                        <div className="font-mono text-xs text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800 break-all flex justify-between items-start gap-2">
                          <span>{receipt.escrowTxHash ?? "Not recorded"}</span>
                          {receipt.escrowExplorerLink && (
                            <a
                              href={receipt.escrowExplorerLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 text-zinc-500 flex-shrink-0 hover:text-amber-500 cursor-pointer" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Release Transaction Hash</div>
                        <div className="font-mono text-xs text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800 break-all flex justify-between items-start gap-2">
                          <span>{receipt.releaseTxHash ?? receipt.arcTxHash}</span>
                          {(receipt.releaseExplorerLink ?? receipt.explorerLink) && (
                            <a
                              href={receipt.releaseExplorerLink ?? receipt.explorerLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 text-zinc-500 flex-shrink-0 hover:text-amber-500 cursor-pointer" />
                            </a>
                          )}
                        </div>
                      </div>

                    </div>

                    <div className="mt-8 pt-6 border-t border-zinc-800/50 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="text-sm font-medium">Cryptographically Verified</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadReceipt(receipt, task, requester, provider)}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded border border-zinc-800"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
