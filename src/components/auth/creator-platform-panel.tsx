"use client";

import { useState } from "react";
import { CheckCircle2, Link2, Lock, Rss } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { hasPrivyConfig } from "@/lib/privy-config";

type Platform = "rss" | "ghost" | "docs";

export function CreatorPlatformPanel() {
  if (!hasPrivyConfig) return <DisabledPlatformPanel reason="Configure Privy to unlock creator platform connections." />;

  return <PrivyPlatformPanel />;
}

function DisabledPlatformPanel({ reason }: { reason: string }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-zinc-500" />
        <h2 className="text-sm font-semibold text-zinc-100">Connect Content Platform</h2>
      </div>
      <p className="text-sm leading-6 text-zinc-500">{reason}</p>
    </section>
  );
}

function PrivyPlatformPanel() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [platform, setPlatform] = useState<Platform>("rss");
  const [url, setUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const wallet = wallets.find((candidate) => candidate.walletClientType === "privy") ?? wallets[0];

  if (!authenticated) {
    return <DisabledPlatformPanel reason="Login with email first, then connect RSS, Ghost, or docs content sources from your creator dashboard." />;
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-300">
            <Rss className="h-3.5 w-3.5" />
            Creator source
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Connect your content platform
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Connected sources import creator-owned content into your dashboard.
            Paid endpoints use your Privy wallet on Arc Testnet.
          </p>
        </div>
        {wallet && (
          <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 font-mono text-[11px] text-zinc-400">
            Arc wallet {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </span>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.5fr_1fr_auto]">
        <select
          value={platform}
          onChange={(event) => setPlatform(event.target.value as Platform)}
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/50"
        >
          <option value="rss">RSS Feed</option>
          <option value="ghost">Ghost</option>
          <option value="docs">Docs Site</option>
        </select>
        <input
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setConnected(false);
          }}
          placeholder="https://creator.example.com/rss.xml"
          className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
        />
        <button
          type="button"
          disabled={!url.trim()}
          onClick={() => setConnected(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
        >
          {connected ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {connected ? "Connected" : "Connect"}
        </button>
      </div>

      {connected && (
        <p className="mt-3 text-xs leading-5 text-emerald-300">
          {platform.toUpperCase()} source connected for this creator session. Next step:
          import selected items into paid x402 endpoints.
        </p>
      )}
    </section>
  );
}
