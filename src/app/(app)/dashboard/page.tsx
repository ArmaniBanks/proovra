"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  LogOut,
  Mail,
  Newspaper,
  Receipt,
  Rss,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useApi } from "@/hooks/useApi";
import {
  ARC_GATEWAY_CHAIN,
  encodeGatewayMintCall,
  MIN_GATEWAY_WITHDRAWAL_AMOUNT,
  type GatewayBurnIntent,
  type GatewayWithdrawalTypedData,
} from "@/lib/gateway-withdrawal";
import type { Hex } from "viem";
import type { CreatorContent, CreatorContentAccess } from "@/lib/mock-data";
import { arcTestnetChain, hasPrivyConfig } from "@/lib/privy-config";
import { formatUSDC } from "@/lib/utils";
import { ProoVraMark } from "@/components/brand/proovra-mark";

const EMPTY_CREATOR_WALLET = "0x0000000000000000000000000000000000000000";
const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

type CreatorContentResponse = {
  contents: CreatorContent[];
  accesses: CreatorContentAccess[];
  summary: {
    publishedCount: number;
    totalAccesses: number;
    totalEarned: number;
    totalGrossVolume: number;
    totalPlatformFees: number;
    activeCreators: number;
    revenue: {
      platformFeePercent: number;
      treasuryConfigured: boolean;
    };
  };
};

type BalanceState = {
  loading: boolean;
  value: string;
  gatewayAvailable: string;
  gatewayWithdrawable: string;
  error: string;
};

type CreatorWalletBalanceResponse = {
  wallet: {
    formatted: string;
  };
  gateway: {
    formattedAvailable: string;
    formattedWithdrawable: string;
  };
  error?: string;
};

type GatewayWithdrawalPrepareResponse = {
  burnIntent: GatewayBurnIntent;
  typedData: GatewayWithdrawalTypedData;
  error?: string;
};

type GatewayWithdrawalSubmitResponse = {
  attestation: `0x${string}`;
  signature: `0x${string}`;
  gateway?: Record<string, unknown>;
  error?: string;
};

type EthereumProvider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type PendingGatewayWithdrawal = {
  creatorWallet: string;
  recipient: string;
  amount: string;
  attestation: `0x${string}`;
  signature: `0x${string}`;
  createdAt: string;
  gateway?: Record<string, unknown>;
};

export default function DashboardPage() {
  if (!hasPrivyConfig) return <PrivySetupDashboard />;
  return <PrivyDashboard />;
}

function PrivySetupDashboard() {
  return (
    <div className="flex min-h-[72vh] items-center justify-center">
      <div className="max-w-2xl rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
          <ShieldCheck className="h-6 w-6 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Configure email login to enable creator dashboards.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Launch App should open this dashboard once email login is configured
          in the deployment environment. Creators can then log in, receive an
          embedded Arc wallet, and manage content monetization from their own
          account.
        </p>
      </div>
    </div>
  );
}

function PrivyDashboard() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-zinc-500">
        Loading creator dashboard...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-[72vh] items-center justify-center">
        <div className="max-w-3xl rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-zinc-900/70 to-zinc-950 p-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <ProoVraMark size={18} />
            Creator dashboard
          </div>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-white">
            Login to manage your paid creator content.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Creators sign in with email. ProoVra creates an embedded wallet on
            Arc Testnet, then keeps your content sources,
            x402 endpoints, USDC balance, receipts, and withdrawals inside your
            creator dashboard.
          </p>
          <button
            type="button"
            onClick={login}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Mail className="h-4 w-4" />
            Login with Email
          </button>
        </div>
      </div>
    );
  }

  return <CreatorDashboard email={user?.email?.address ?? "Creator account"} onLogout={logout} />;
}

function CreatorDashboard({
  email,
  onLogout,
}: {
  email: string;
  onLogout: () => void;
}) {
  const { wallets, ready: walletsReady } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const embeddedWallet =
    wallets.find((wallet) => wallet.walletClientType === "privy") ?? wallets[0];
  const walletAddress = embeddedWallet?.address ?? "";
  const creatorContentEndpoint = `/api/creator-content?creatorWallet=${encodeURIComponent(
    walletAddress || EMPTY_CREATOR_WALLET
  )}`;
  const { data, loading, error } =
    useApi<CreatorContentResponse>(creatorContentEndpoint);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<BalanceState>({
    loading: false,
    value: "0.000000",
    gatewayAvailable: "0.000000",
    gatewayWithdrawable: "0.000000",
    error: "",
  });
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] =
    useState<PendingGatewayWithdrawal | null>(null);
  const [walletSendTo, setWalletSendTo] = useState("");
  const [walletSendAmount, setWalletSendAmount] = useState("");
  const [walletSendStatus, setWalletSendStatus] = useState("");
  const [walletSending, setWalletSending] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileRegistered, setProfileRegistered] = useState(false);
  const [profileEditing, setProfileEditing] = useState(true);
  const publicationPath = profileUsername ? `/creator/${profileUsername}` : "";

  const summary = data?.summary;
  const contents = data?.contents ?? [];
  const latestContent = contents[0];

  const withdrawValidation = useMemo(() => {
    if (!walletAddress) return "Creator wallet is still loading.";
    if (!isAddress(withdrawTo)) return "Enter a valid destination wallet address.";
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      return "Enter the USDC amount to withdraw.";
    }
    if (Number(withdrawAmount) < Number(MIN_GATEWAY_WITHDRAWAL_AMOUNT)) {
      return `Minimum Gateway withdrawal is ${MIN_GATEWAY_WITHDRAWAL_AMOUNT} USDC.`;
    }
    if (pendingWithdrawal) return "Finish the pending Gateway mint before starting another withdrawal.";
    return "";
  }, [pendingWithdrawal, walletAddress, withdrawAmount, withdrawTo]);
  const canWithdraw = !withdrawValidation;
  const walletSendValidation = useMemo(() => {
    if (!walletAddress) return "Creator wallet is still loading.";
    if (!isAddress(walletSendTo)) return "Enter a valid destination wallet address.";
    if (walletSendTo.toLowerCase() === EMPTY_CREATOR_WALLET) {
      return "Destination wallet cannot be the zero address.";
    }
    if (!walletSendAmount || Number(walletSendAmount) <= 0) {
      return "Enter the USDC amount to send.";
    }
    try {
      if (parseTokenUnits(walletSendAmount, 6) > parseTokenUnits(balance.value, 6)) {
        return `Wallet balance is ${balance.value} USDC. Enter a smaller amount.`;
      }
    } catch (error) {
      return error instanceof Error ? error.message : "Enter a valid USDC amount.";
    }
    return "";
  }, [balance.value, walletAddress, walletSendAmount, walletSendTo]);
  const canSendFromWallet = !walletSendValidation;

  useEffect(() => {
    if (!walletAddress) return;
    let active = true;

    async function loadBalance() {
      setBalance((current) => ({ ...current, loading: true, error: "" }));
      try {
        const value = await fetchCreatorWalletBalances(walletAddress);
        if (active) setBalance({ loading: false, ...value, error: "" });
      } catch (error) {
        if (active) {
          setBalance({
            loading: false,
            value: "0.000000",
            gatewayAvailable: "0.000000",
            gatewayWithdrawable: "0.000000",
            error: error instanceof Error ? error.message : "Balance unavailable",
          });
        }
      }
    }

    void loadBalance();
    const interval = window.setInterval(loadBalance, 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    let active = true;
    async function loadProfile() {
      try {
        const response = await fetch(
          `/api/creator-profile?creatorWallet=${encodeURIComponent(walletAddress)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          profile?: { displayName: string; username: string } | null;
        };
        if (!active || !payload.profile) return;
        setProfileDisplayName(payload.profile.displayName);
        setProfileUsername(payload.profile.username);
        setProfileRegistered(true);
        setProfileEditing(false);
      } catch {
        // The dashboard stays usable even before a public profile is created.
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    const frame = window.requestAnimationFrame(() => {
      setPendingWithdrawal(loadPendingGatewayWithdrawal(walletAddress));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    const frame = window.requestAnimationFrame(() => {
      setWithdrawTo((current) => current || walletAddress);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [walletAddress]);

  async function copyWallet() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function withdrawFunds() {
    if (!canWithdraw || !walletAddress) {
      setWithdrawStatus(withdrawValidation || "Withdrawal form is not ready.");
      return;
    }

    setWithdrawing(true);
    setWithdrawStatus("");
    try {
      if (Number(withdrawAmount) < Number(MIN_GATEWAY_WITHDRAWAL_AMOUNT)) {
        throw new Error(
          `Minimum Gateway withdrawal is ${MIN_GATEWAY_WITHDRAWAL_AMOUNT} USDC to avoid outsized network/Gateway fees on tiny withdrawals.`
        );
      }
      if (!embeddedWallet) throw new Error("Creator wallet is not ready.");
      setWithdrawStatus("Preparing Gateway withdrawal...");
      const prepare = await prepareGatewayWithdrawal({
        creatorWallet: walletAddress,
        recipient: withdrawTo,
        amount: withdrawAmount,
      });
      const provider = await getEthereumProvider(embeddedWallet);
      setWithdrawStatus("Waiting for creator wallet signature...");
      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [walletAddress, JSON.stringify(prepare.typedData)],
      });
      if (typeof signature !== "string") {
        throw new Error("Creator wallet did not return a valid signature.");
      }

      setWithdrawStatus("Submitting signed withdrawal to Circle Gateway...");
      const attestation = await submitGatewayWithdrawal({
        creatorWallet: walletAddress,
        burnIntent: prepare.burnIntent,
        signature,
      });
      const pending: PendingGatewayWithdrawal = {
        creatorWallet: walletAddress,
        recipient: withdrawTo,
        amount: withdrawAmount,
        attestation: attestation.attestation,
        signature: attestation.signature,
        createdAt: new Date().toISOString(),
        gateway: attestation.gateway,
      };
      savePendingGatewayWithdrawal(pending);
      setPendingWithdrawal(pending);

      setWithdrawStatus("Minting withdrawn USDC to the destination wallet...");
      const result = await mintPendingGatewayWithdrawal(pending);
      setWithdrawStatus(`Waiting for Arc confirmation: ${result.hash}`);
      await waitForSuccessfulTransaction(result.hash, "Arc mint transaction");
      setWithdrawStatus(`Gateway withdrawal minted: ${result.hash}`);
      clearPendingGatewayWithdrawal(walletAddress);
      setPendingWithdrawal(null);
      setWithdrawAmount("");
      setWithdrawTo("");
      setBalance((current) => ({ ...current, loading: true }));
      const refreshed = await fetchCreatorWalletBalances(walletAddress);
      setBalance({ loading: false, ...refreshed, error: "" });
    } catch (error) {
      setWithdrawStatus(
        error instanceof Error ? error.message : "Withdrawal failed"
      );
    } finally {
      setWithdrawing(false);
    }
  }

  async function sendFromWallet() {
    if (!canSendFromWallet || !walletAddress) {
      setWalletSendStatus(walletSendValidation || "Wallet transfer form is not ready.");
      return;
    }

    setWalletSending(true);
    setWalletSendStatus("");
    try {
      const data = encodeUsdcTransfer(walletSendTo, walletSendAmount);
      setWalletSendStatus("Submitting wallet USDC transfer...");
      const result = await sendTransaction(
        {
          to: ARC_USDC_ADDRESS,
          data,
          value: "0x0",
          chainId: arcTestnetChain.id,
        },
        { address: walletAddress }
      );
      setWalletSendStatus(`Waiting for Arc confirmation: ${result.hash}`);
      await waitForSuccessfulTransaction(result.hash, "Wallet USDC transfer");
      setWalletSendStatus(`Wallet USDC sent: ${result.hash}`);
      setWalletSendAmount("");
      setWalletSendTo("");
      setBalance((current) => ({ ...current, loading: true }));
      const refreshed = await fetchCreatorWalletBalances(walletAddress);
      setBalance({ loading: false, ...refreshed, error: "" });
    } catch (error) {
      setWalletSendStatus(
        error instanceof Error ? error.message : "Wallet USDC transfer failed"
      );
    } finally {
      setWalletSending(false);
    }
  }

  async function saveProfile() {
    if (!walletAddress) return;
    setProfileSaving(true);
    setProfileStatus("");
    try {
      const response = await fetch("/api/creator-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorWallet: walletAddress,
          email,
          displayName: profileDisplayName,
          username: profileUsername,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        profile?: { displayName: string; username: string };
      };
      if (!response.ok) throw new Error(payload.error ?? "Profile update failed.");
      if (payload.profile) {
        setProfileDisplayName(payload.profile.displayName);
        setProfileUsername(payload.profile.username);
        setProfileRegistered(true);
        setProfileEditing(false);
      }
      setProfileStatus("Public creator profile saved.");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function retryPendingMint() {
    if (!pendingWithdrawal || !walletAddress) return;
    setWithdrawing(true);
    setWithdrawStatus("Retrying Gateway mint transaction...");
    try {
      const result = await mintPendingGatewayWithdrawal(pendingWithdrawal);
      setWithdrawStatus(`Waiting for Arc confirmation: ${result.hash}`);
      await waitForSuccessfulTransaction(result.hash, "Arc mint transaction");
      setWithdrawStatus(`Gateway withdrawal minted: ${result.hash}`);
      clearPendingGatewayWithdrawal(walletAddress);
      setPendingWithdrawal(null);
      setBalance((current) => ({ ...current, loading: true }));
      const refreshed = await fetchCreatorWalletBalances(walletAddress);
      setBalance({ loading: false, ...refreshed, error: "" });
    } catch (error) {
      setWithdrawStatus(
        error instanceof Error ? error.message : "Retry mint failed"
      );
    } finally {
      setWithdrawing(false);
    }
  }

  async function mintPendingGatewayWithdrawal(pending: PendingGatewayWithdrawal) {
    const data = encodeGatewayMintCall({
      attestation: pending.attestation,
      signature: pending.signature,
    });
    return sendTransaction(
      {
        to: ARC_GATEWAY_CHAIN.gatewayMinter,
        data,
        value: "0x0",
        chainId: arcTestnetChain.id,
      },
      { address: walletAddress }
    );
  }

  async function waitForSuccessfulTransaction(hash: Hex, label: string) {
    const response = await fetch(
      `/api/arc-transaction?hash=${encodeURIComponent(hash)}`,
      { cache: "no-store" }
    );
    const receipt = (await response.json()) as {
      status?: "success" | "reverted";
      error?: string;
    };
    if (!response.ok) {
      throw new Error(
        `${label} could not be confirmed yet: ${
          receipt.error ?? "Arc confirmation failed."
        }`
      );
    }
    if (receipt.status !== "success") {
      throw new Error(
        `${label} reverted: ${hash}. ${
          label.includes("mint")
            ? "The Gateway attestation was kept so you can retry minting instead of creating a new withdrawal."
            : "No USDC was transferred, but gas may still be spent by the network."
        }`
      );
    }
  }

  if (error) {
    return <div className="p-8 text-red-400">Error loading dashboard: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-zinc-900/70 to-zinc-950 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Creator dashboard
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome, {profileRegistered ? profileDisplayName : email}
            </h1>
            {profileRegistered && (
              <p className="mt-2 text-xs text-zinc-500">
                Signed in as {email}
              </p>
            )}
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Manage your profile, wallet, verified sources, published
              resources, receipts, and earnings from one place.
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-red-500/30 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex rounded-lg bg-amber-500/10 p-2">
                <Wallet className="h-4 w-4 text-amber-400" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Creator Arc Wallet
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                This embedded wallet is used for your Arc Testnet creator
                account.
              </p>
            </div>
            <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] text-zinc-400">
              Arc Testnet
            </span>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-600">
              Wallet address
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <code className="break-all font-mono text-xs text-zinc-300">
                {walletsReady && walletAddress ? walletAddress : "Generating wallet..."}
              </code>
              <button
                type="button"
                onClick={copyWallet}
                disabled={!walletAddress}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300 disabled:text-zinc-700"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                Wallet USDC
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                {balance.loading ? "..." : balance.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">On-chain Arc balance</p>
              {balance.error && (
                <p className="mt-2 text-xs text-red-400">{balance.error}</p>
              )}
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                Gateway Available
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                {balance.loading ? "..." : balance.gatewayAvailable}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Circle Gateway balance
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                Net Earned From Agents
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                {loading ? "..." : formatUSDC(summary?.totalEarned ?? 0)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">After ProoVra fee</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                ProoVra Fees
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-amber-300">
                {loading ? "..." : formatUSDC(summary?.totalPlatformFees ?? 0)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {summary?.revenue.platformFeePercent ?? 10}% platform take-rate
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Agent payments settle through Circle Gateway first. Wallet USDC is
            normal on-chain USDC; Gateway Available is the creator address&apos;s
            Gateway balance that can later be withdrawn/minted to a wallet.
            ProoVra fees are tracked in receipts for treasury claim and reporting.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-4 inline-flex rounded-lg bg-amber-500/10 p-2">
            <Send className="h-4 w-4 text-amber-400" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">Withdraw Funds</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Move available Circle Gateway USDC into an Arc Testnet wallet.
          </p>
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-xs leading-5 text-amber-100/80">
                Gateway withdrawals can include a fixed fee, so tiny withdrawals
                may receive much less than expected. ProoVra blocks withdrawals
                below {MIN_GATEWAY_WITHDRAWAL_AMOUNT} USDC and saves the mint
                attestation before sending the final Arc transaction.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {pendingWithdrawal && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-xs font-semibold text-emerald-200">
                  Pending Gateway mint
                </p>
                <p className="mt-1 break-all text-xs leading-5 text-emerald-100/70">
                  {pendingWithdrawal.amount} USDC was attested for{" "}
                  {pendingWithdrawal.recipient}. If the wallet transaction
                  failed, retry the mint instead of creating a new withdrawal.
                </p>
                <button
                  type="button"
                  onClick={retryPendingMint}
                  disabled={withdrawing}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:border-emerald-300/50 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
                >
                  <Send className="h-4 w-4" />
                  {withdrawing ? "Retrying" : "Retry Mint"}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-emerald-100/60">
                  New withdrawals stay locked until this mint confirms or you
                  retry it. This protects the already-attested Gateway transfer.
                </p>
              </div>
            )}
            <input
              value={withdrawTo}
              onChange={(event) => setWithdrawTo(event.target.value)}
              placeholder="Destination wallet address"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={() => {
                if (walletAddress) setWithdrawTo(walletAddress);
              }}
              disabled={!walletAddress}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:text-zinc-600"
            >
              Use my creator wallet
            </button>
            <input
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              inputMode="decimal"
              placeholder="Amount USDC"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={withdrawFunds}
              disabled={!canWithdraw || withdrawing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
            >
              <Send className="h-4 w-4" />
              {withdrawing ? "Withdrawing" : "Withdraw USDC"}
            </button>
            {withdrawStatus && (
              <p
                className={`break-all text-xs leading-5 ${
                  withdrawStatus.toLowerCase().includes("failed") ||
                  withdrawStatus.toLowerCase().includes("error") ||
                  withdrawStatus.toLowerCase().includes("valid") ||
                  withdrawStatus.toLowerCase().includes("minimum") ||
                  withdrawStatus.toLowerCase().includes("insufficient")
                    ? "text-red-300"
                    : "text-zinc-400"
                }`}
              >
                {withdrawStatus}
              </p>
            )}
            {!canWithdraw && !withdrawStatus && (
              <p className="text-xs leading-5 text-zinc-500">{withdrawValidation}</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-lg bg-emerald-500/10 p-2">
              <CircleDollarSign className="h-4 w-4 text-emerald-300" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Withdraw From Privy Wallet
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
              Send USDC already minted into your Privy creator wallet to any Arc
              Testnet wallet address. This is a normal USDC wallet transfer, not
              a Gateway withdrawal.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-wider text-zinc-600">
              Wallet USDC
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-zinc-100">
              {balance.loading ? "..." : balance.value}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.45fr_auto]">
          <input
            value={walletSendTo}
            onChange={(event) => setWalletSendTo(event.target.value)}
            placeholder="Destination wallet address"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
          />
          <input
            value={walletSendAmount}
            onChange={(event) => setWalletSendAmount(event.target.value)}
            inputMode="decimal"
            placeholder="Amount USDC"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
          />
          <button
            type="button"
            onClick={sendFromWallet}
            disabled={!canSendFromWallet || walletSending}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
          >
            <Send className="h-4 w-4" />
            {walletSending ? "Sending" : "Send USDC"}
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-zinc-500">
            Available to send: {balance.loading ? "..." : balance.value} USDC
            on Arc Testnet.
          </p>
          <button
            type="button"
            onClick={() => setWalletSendAmount(balance.value)}
            disabled={balance.loading || Number(balance.value) <= 0}
            className="inline-flex items-center justify-center rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-zinc-600"
          >
            Max
          </button>
        </div>
        {walletSendStatus ? (
          <p
            className={`mt-3 break-all text-xs leading-5 ${
              walletSendStatus.toLowerCase().includes("failed") ||
              walletSendStatus.toLowerCase().includes("error") ||
              walletSendStatus.toLowerCase().includes("valid") ||
              walletSendStatus.toLowerCase().includes("reverted")
                ? "text-red-300"
                : "text-zinc-400"
            }`}
          >
            {walletSendStatus}
          </p>
        ) : (
          !canSendFromWallet && (
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              {walletSendValidation}
            </p>
          )
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-lg bg-amber-500/10 p-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Public Creator Profile
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
              Agents and public discovery see this name, not your login email.
              Saving also updates existing content tied to this wallet.
            </p>
          </div>
          {profileRegistered && !profileEditing ? (
            <button
              type="button"
              onClick={() => {
                setProfileStatus("");
                setProfileEditing(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500/40 hover:text-amber-300"
            >
              Edit Profile
            </button>
          ) : (
            <button
              type="button"
              onClick={saveProfile}
              disabled={!walletAddress || profileSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              {profileSaving ? "Saving" : "Save Profile"}
            </button>
          )}
        </div>
        {profileRegistered && !profileEditing ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                Display name
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {profileDisplayName}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                Username
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-amber-300">
                @{profileUsername}
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-[11px] uppercase tracking-wider text-amber-300">
                Shareable publication page
              </p>
              <Link
                href={publicationPath}
                className="mt-1 inline-flex break-all text-sm font-semibold text-amber-200 transition-colors hover:text-amber-100"
              >
                {publicationPath}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={profileDisplayName}
              onChange={(event) => setProfileDisplayName(event.target.value)}
              placeholder="Public display name, e.g. Elonmusk"
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <input
              value={profileUsername}
              onChange={(event) => setProfileUsername(event.target.value)}
              placeholder="username, e.g. elon"
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
            />
          </div>
        )}
        {profileStatus && (
          <p
            className={`mt-3 text-xs ${
              profileStatus.includes("saved") ? "text-emerald-300" : "text-red-400"
            }`}
          >
            {profileStatus}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Newspaper}
          label="Published Resources"
          value={loading ? "..." : summary?.publishedCount ?? 0}
        />
        <StatCard
          icon={Bot}
          label="Paid Agent Accesses"
          value={loading ? "..." : summary?.totalAccesses ?? 0}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Creator Net"
          value={loading ? "..." : formatUSDC(summary?.totalEarned ?? 0)}
        />
        <StatCard
          icon={Receipt}
          label="ProoVra Fees"
          value={loading ? "..." : formatUSDC(summary?.totalPlatformFees ?? 0)}
        />
        <StatCard
          icon={Receipt}
          label="Gross Volume"
          value={loading ? "..." : formatUSDC(summary?.totalGrossVolume ?? 0)}
        />
      </div>

      <RssVerificationStatus creatorWallet={walletAddress} />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Creator Content</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Your published resources and shareable paid pages.
            </p>
          </div>
          <Link
            href="/content"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            Manage Content
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {latestContent ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-base font-semibold text-zinc-100">{latestContent.title}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {latestContent.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-zinc-400">
                {latestContent.source.toUpperCase()}
              </span>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-300">
                {formatUSDC(latestContent.price)} per access
              </span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                {latestContent.accessCount} paid accesses
              </span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <Newspaper className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">
              No creator resources yet
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Verify an RSS feed or publish your first paid resource.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type RssVerificationRecord = {
  id: string;
  feedUrl: string;
  domain: string;
  verificationCode: string;
  status: "pending" | "verified";
  verifiedAt?: string;
};

function RssVerificationStatus({ creatorWallet }: { creatorWallet: string }) {
  const [records, setRecords] = useState<RssVerificationRecord[]>([]);

  useEffect(() => {
    if (!creatorWallet) return;
    let active = true;
    async function loadVerifications() {
      try {
        const response = await fetch(
          `/api/integrations/rss?creatorWallet=${encodeURIComponent(creatorWallet)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          verifications?: RssVerificationRecord[];
        };
        if (active) setRecords(payload.verifications ?? []);
      } catch {
        // Verification status is helpful, but the dashboard should stay usable.
      }
    }
    const frame = window.requestAnimationFrame(() => {
      void loadVerifications();
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, [creatorWallet]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex rounded-lg bg-amber-500/10 p-2">
            <Rss className="h-4 w-4 text-amber-400" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">
            RSS Ownership Verification
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Feeds must be verified before their posts can become paid x402
            resources.
          </p>
        </div>
        <Link href="/content" className="text-xs text-amber-300 hover:text-amber-200">
          Import RSS
        </Link>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No RSS feeds verified yet. Import a public feed from the content page.
        </p>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-200">
                  {record.domain}
                </p>
                <p className="truncate text-xs text-zinc-600">{record.feedUrl}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${
                  record.status === "verified"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                }`}
              >
                {record.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 inline-flex rounded-lg bg-amber-500/10 p-2">
        <Icon className="h-4 w-4 text-amber-400" />
      </div>
      <p className="font-mono text-2xl font-semibold tracking-tight text-zinc-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

async function fetchCreatorWalletBalances(address: string) {
  const response = await fetch(
    `/api/creator-wallet?address=${encodeURIComponent(address)}`,
    { cache: "no-store" }
  );
  const payload = (await response.json()) as CreatorWalletBalanceResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Creator wallet balances unavailable.");
  }

  return {
    value: payload.wallet.formatted,
    gatewayAvailable: payload.gateway.formattedAvailable,
    gatewayWithdrawable: payload.gateway.formattedWithdrawable,
  };
}

async function prepareGatewayWithdrawal(input: {
  creatorWallet: string;
  recipient: string;
  amount: string;
}) {
  const response = await fetch("/api/creator-wallet/withdraw/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as GatewayWithdrawalPrepareResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Gateway withdrawal preparation failed.");
  }
  return payload;
}

async function submitGatewayWithdrawal(input: {
  creatorWallet: string;
  burnIntent: GatewayBurnIntent;
  signature: string;
}) {
  const response = await fetch("/api/creator-wallet/withdraw/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as GatewayWithdrawalSubmitResponse;
  if (!response.ok) {
    throw new Error(payload.error ?? "Gateway withdrawal submission failed.");
  }
  return payload;
}

async function getEthereumProvider(wallet: unknown): Promise<EthereumProvider> {
  const candidate = wallet as {
    getEthereumProvider?: () => Promise<EthereumProvider>;
  };
  if (typeof candidate.getEthereumProvider !== "function") {
    throw new Error("Creator wallet cannot sign Gateway withdrawal intents.");
  }
  return candidate.getEthereumProvider();
}

function pendingGatewayWithdrawalKey(wallet: string) {
  return `proovra:pending-gateway-withdrawal:${wallet.toLowerCase()}`;
}

function savePendingGatewayWithdrawal(pending: PendingGatewayWithdrawal) {
  window.localStorage.setItem(
    pendingGatewayWithdrawalKey(pending.creatorWallet),
    JSON.stringify(pending)
  );
}

function loadPendingGatewayWithdrawal(wallet: string) {
  try {
    const raw = window.localStorage.getItem(pendingGatewayWithdrawalKey(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingGatewayWithdrawal;
    if (parsed.creatorWallet.toLowerCase() !== wallet.toLowerCase()) return null;
    if (!isAddress(parsed.recipient)) return null;
    if (!parsed.attestation || !parsed.signature) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingGatewayWithdrawal(wallet: string) {
  window.localStorage.removeItem(pendingGatewayWithdrawalKey(wallet));
}

function encodeUsdcTransfer(to: string, amount: string): `0x${string}` {
  const units = parseTokenUnits(amount, 6);
  const recipient = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const value = units.toString(16).padStart(64, "0");
  return `0xa9059cbb${recipient}${value}` as `0x${string}`;
}

function parseTokenUnits(value: string, decimals: number) {
  const [whole = "0", fraction = ""] = value.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error("Amount must be a valid USDC value.");
  }
  if (fraction.length > decimals) {
    throw new Error(`Amount can only include up to ${decimals} decimals.`);
  }
  const normalizedFraction = fraction.padEnd(decimals, "0");
  const parsed =
    BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) +
    BigInt(normalizedFraction || "0");
  if (parsed <= BigInt(0)) throw new Error("Amount must be greater than zero.");
  return parsed;
}

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}
