"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  LogOut,
  PlugZap,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearConnectedWallet,
  saveConnectedWallet,
  useConnectedWallet,
} from "@/hooks/useConnectedWallet";

type ProviderMode = "simulation" | "live" | "hybrid";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: "accountsChanged" | "chainChanged",
    handler: (...args: unknown[]) => void
  ) => void;
};

type ProviderStatusResponse = {
  mode: ProviderMode;
  settlementExecution: "wallet-signed";
  liveSettlementEnabled: boolean;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const arcTestnet = {
  name: "Arc Testnet",
  chainId: "0x4cef52",
  currency: "USDC",
  role: "USDC settlement readiness",
  settlement: "Validated on testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorerUrl: "https://testnet.arcscan.app",
};

function getProviderMode(): ProviderMode {
  const mode = process.env.NEXT_PUBLIC_PROOVRA_PROVIDER_MODE;

  if (mode === "live" || mode === "hybrid") {
    return mode;
  }

  return "live";
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletReadinessPanel() {
  const walletAddress = useConnectedWallet();
  const [walletChainId, setWalletChainId] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [providerMode, setProviderMode] = useState<ProviderMode>(getProviderMode);
  const isSimulation = providerMode === "simulation";
  const isArcTestnet = walletChainId.toLowerCase() === arcTestnet.chainId;

  useEffect(() => {
    let active = true;

    async function loadProviderStatus() {
      try {
        const response = await fetch("/api/provider-status");
        if (!response.ok) return;

        const status = (await response.json()) as ProviderStatusResponse;
        if (active) {
          setProviderMode(status.mode);
        }
      } catch {
        // Keep local wallet mode if the readiness status endpoint is unavailable.
      }
    }

    void loadProviderStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    function handleAccountsChanged(accounts: unknown) {
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
        setWalletChainId("");
        clearConnectedWallet();
        return;
      }

      saveConnectedWallet(accounts[0]);
    }

    function handleChainChanged(chainId: unknown) {
      setWalletChainId(typeof chainId === "string" ? chainId : "");
    }

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function readNetwork() {
      if (!walletAddress || !window.ethereum) {
        setWalletChainId("");
        return;
      }

      try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (active && typeof chainId === "string") {
          setWalletChainId(chainId);
        }
      } catch {
        if (active) setWalletChainId("");
      }
    }

    void readNetwork();

    return () => {
      active = false;
    };
  }, [walletAddress]);

  const providerStatus = useMemo(() => {
    if (providerMode === "live") {
      return {
        label: "Live provider mode",
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      };
    }

    if (providerMode === "hybrid") {
      return {
        label: "Hybrid provider mode",
        className: "border-blue-500/20 bg-blue-500/10 text-blue-400",
      };
    }

    return {
      label: "Arc Wallet Mode",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    };
  }, [providerMode]);

  async function connectWallet() {
    setConnectionError("");

    if (!window.ethereum) {
      setConnectionError("No browser wallet detected. Install or enable a wallet to connect.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
        throw new Error("Wallet did not return an account.");
      }

      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (typeof chainId !== "string") {
        throw new Error("Wallet did not return a chain id.");
      }

      if (chainId.toLowerCase() !== arcTestnet.chainId) {
        await switchToArcTestnet();
      }

      const activeChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (typeof activeChainId === "string") {
        setWalletChainId(activeChainId);
      }
      saveConnectedWallet(accounts[0]);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Wallet connection failed."
      );
    }
  }

  function disconnectWallet() {
    setWalletChainId("");
    setConnectionError("");
    clearConnectedWallet();
  }

  async function switchToArcTestnet() {
    setConnectionError("");

    if (!window.ethereum) {
      setConnectionError("No browser wallet detected. Install or enable a wallet to switch networks.");
      return;
    }

    try {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: arcTestnet.chainId }],
        });
      } catch (switchError) {
        const code =
          typeof switchError === "object" &&
          switchError !== null &&
          "code" in switchError
            ? (switchError as { code?: number }).code
            : undefined;

        if (code !== 4902) {
          throw switchError;
        }

        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: arcTestnet.chainId,
              chainName: arcTestnet.name,
              nativeCurrency: {
                name: "Arc Testnet ETH",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: [arcTestnet.rpcUrl],
              blockExplorerUrls: [arcTestnet.explorerUrl],
            },
          ],
        });
      }

      const activeChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (typeof activeChainId === "string") {
        setWalletChainId(activeChainId);
      }
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Arc Testnet switch failed."
      );
    }
  }

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider",
                  providerStatus.className
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {providerStatus.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                <PlugZap className="h-3.5 w-3.5" />
                Testnet paths validated
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-zinc-100">
              Wallet and Arc testnet readiness
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
              ProoVra uses persisted application records from the local database
              and has verified real Arc Testnet escrow/release, two-wallet
              settlement, and x402 authorization.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            {walletAddress ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-mono">{shortenAddress(walletAddress)}</span>
                </div>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:text-red-300"
                  title="Disconnect wallet from ProoVra"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={connectWallet}
                className="inline-flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </button>
            )}
            {connectionError && (
              <div className="flex max-w-xs items-start gap-2 text-xs leading-5 text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{connectionError}</span>
              </div>
            )}
          </div>
        </div>

        {walletAddress && (
          <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Connected wallet
              </span>
              <span className="font-mono text-xs text-zinc-300">
                {walletAddress}
              </span>
              <Copy className="h-3.5 w-3.5 text-zinc-600" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/70 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Network
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[11px]",
                    isArcTestnet
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                  )}
                >
                  {isArcTestnet ? "Arc Testnet" : walletChainId || "Unchecked"}
                </span>
              </div>
              {!isArcTestnet && (
                <button
                  type="button"
                  onClick={switchToArcTestnet}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15"
                >
                  <PlugZap className="h-3.5 w-3.5" />
                  Switch to Arc
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {arcTestnet.name}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">{arcTestnet.role}</p>
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Testnet
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-zinc-500">Asset</dt>
            <dd className="mt-1 font-mono text-zinc-200">{arcTestnet.currency}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Settlement</dt>
            <dd className="mt-1 text-zinc-200">{arcTestnet.settlement}</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <div>
              <h3 className="text-xs font-medium text-amber-400">
                Test token helper
              </h3>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Use Arc testnet faucet guidance for controlled provider-mode
                tests. UI settlement actions require wallet-signed Arc Testnet
                transactions before records are persisted.
              </p>
              <a
                href="https://docs.arc.network"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
              >
                Arc docs
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {isSimulation && (
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">
            Current provider mode is local wallet execution. Arc settlement
            actions require confirmed testnet transactions.
          </p>
        )}
      </div>
    </section>
  );
}
