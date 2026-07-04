"use client";

import { LogOut, Mail, Plug, ShieldCheck, Wallet } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { hasPrivyConfig } from "@/lib/privy-config";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getEmail(user: ReturnType<typeof usePrivy>["user"]) {
  return user?.email?.address ?? "Email creator account";
}

export function CreatorLoginPanel() {
  if (!hasPrivyConfig) return <PrivySetupPanel />;

  return <PrivyCreatorLoginPanel />;
}

function PrivySetupPanel() {
  return (
    <section className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-zinc-950/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Privy login not configured
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Creator dashboard login will use Privy email auth
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">
            Set `NEXT_PUBLIC_PRIVY_APP_ID` to enable email login and automatic
            embedded wallet creation for creators. The wallet context defaults to
            Arc Testnet.
          </p>
        </div>
        <code className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
          NEXT_PUBLIC_PRIVY_APP_ID=...
        </code>
      </div>
    </section>
  );
}

function PrivyCreatorLoginPanel() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const embeddedWallet =
    wallets.find((wallet) => wallet.walletClientType === "privy") ?? wallets[0];

  if (!ready) {
    return (
      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-sm text-zinc-500">Loading creator session...</p>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="mb-6 rounded-xl border border-amber-500/20 bg-zinc-900/60 p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-300">
              <Mail className="h-3.5 w-3.5" />
              Creator login
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Sign in to manage your creator dashboard.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Creators use email login through Privy. ProoVra automatically
              provisions an embedded wallet for Arc Testnet so paid content,
              platform connections, and receipts all live under one creator account.
            </p>
          </div>
          <button
            type="button"
            onClick={login}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Mail className="h-4 w-4" />
            Login with Email
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-zinc-950/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Creator session active
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">{getEmail(user)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/50 px-2.5 py-1">
              <Plug className="h-3.5 w-3.5" />
              Arc Testnet dashboard
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/50 px-2.5 py-1">
              <Wallet className="h-3.5 w-3.5" />
              {walletsReady && embeddedWallet
                ? shortenAddress(embeddedWallet.address)
                : "Generating wallet"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-red-500/30 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </section>
  );
}
