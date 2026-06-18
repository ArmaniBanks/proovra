import { createArcTestnetSettlementProvider } from "./arc-testnet.provider";
import { createCircleCliWalletProvider } from "./circle-cli.provider";
import { createCircleCliX402PaymentAuthorizationProvider } from "./circle-cli-x402.provider";
import { createCircleSandboxWalletProvider } from "./circle-sandbox.provider";
import { createSimulationProviders } from "./simulation.provider";
import type {
  PaymentAuthorizationProviderMode,
  ProviderMode,
  ProoVraProviders,
  SettlementProviderMode,
  WalletProviderMode,
} from "./types";

function resolveProviderMode(): ProviderMode {
  const rawMode = process.env.PROOVRA_PROVIDER_MODE || process.env.PAYMENT_MODE;

  if (rawMode === "live" || rawMode === "hybrid") {
    return rawMode;
  }

  return "simulation";
}

function resolveWalletProviderMode(): WalletProviderMode {
  const rawMode = process.env.PROOVRA_WALLET_PROVIDER;

  if (rawMode === "circle-sandbox" || rawMode === "circle-cli") {
    return rawMode;
  }

  return "simulation";
}

function resolveSettlementProviderMode(): SettlementProviderMode {
  const rawMode = process.env.PROOVRA_SETTLEMENT_PROVIDER;

  if (rawMode === "arc-testnet") {
    return rawMode;
  }

  return "simulation";
}

function resolvePaymentAuthorizationProviderMode(): PaymentAuthorizationProviderMode {
  const rawMode = process.env.PROOVRA_PAYMENT_PROVIDER;

  if (rawMode === "circle-cli-x402") {
    return rawMode;
  }

  return "simulation";
}

function createProviders(): ProoVraProviders {
  const mode = resolveProviderMode();
  const settlementMode = resolveSettlementProviderMode();
  const walletMode = resolveWalletProviderMode();
  const paymentAuthorizationMode = resolvePaymentAuthorizationProviderMode();
  const simulationProviders = createSimulationProviders();
  const settlementProvider =
    settlementMode === "arc-testnet"
      ? createArcTestnetSettlementProvider()
      : simulationProviders.settlement;
  const walletProvider =
    walletMode === "circle-cli"
      ? createCircleCliWalletProvider()
      : walletMode === "circle-sandbox"
      ? createCircleSandboxWalletProvider()
      : simulationProviders.wallet;
  const paymentAuthorizationProvider =
    paymentAuthorizationMode === "circle-cli-x402"
      ? createCircleCliX402PaymentAuthorizationProvider()
      : simulationProviders.paymentAuthorization;

  return {
    mode,
    settlementMode,
    walletMode,
    paymentAuthorizationMode,
    settlement: settlementProvider,
    wallet: walletProvider,
    paymentAuthorization: paymentAuthorizationProvider,
  };
}

let providers: ProoVraProviders | undefined;

export function getProviders(): ProoVraProviders {
  providers ??= createProviders();
  return providers;
}

export type {
  AgentWallet,
  AgentWalletCreateInput,
  EscrowCreateInput,
  EscrowCreateResult,
  PaymentAuthorizationInput,
  PaymentAuthorizationProvider,
  PaymentAuthorizationProviderMode,
  PaymentAuthorizationResult,
  ProviderMode,
  ProoVraProviders,
  SettlementProviderMode,
  SettlementProvider,
  SettlementReleaseInput,
  SettlementReleaseResult,
  WalletProviderMode,
  WalletProvider,
  WalletTransferInput,
  WalletTransferResult,
} from "./types";
