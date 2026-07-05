import { createArcTestnetSettlementProvider } from "./arc-testnet.provider";
import { createCircleCliWalletProvider } from "./circle-cli.provider";
import { createCircleCliX402PaymentAuthorizationProvider } from "./circle-cli-x402.provider";
import { createCircleSandboxWalletProvider } from "./circle-sandbox.provider";
import type {
  PaymentAuthorizationProviderMode,
  ProviderMode,
  ProoVraProviders,
  SettlementProviderMode,
  WalletProviderMode,
} from "./types";

function resolveProviderMode(): ProviderMode {
  const rawMode = process.env.PROOVRA_PROVIDER_MODE || process.env.PAYMENT_MODE;

  if (!rawMode || rawMode === "live") {
    return "live";
  }

  throw new Error("PROOVRA_PROVIDER_MODE must be live. Simulation fallback is disabled.");
}

function resolveWalletProviderMode(): WalletProviderMode {
  const rawMode = process.env.PROOVRA_WALLET_PROVIDER;

  if (rawMode === "circle-sandbox" || rawMode === "circle-cli") {
    return rawMode;
  }

  throw new Error(
    "PROOVRA_WALLET_PROVIDER must be circle-cli or circle-sandbox. Simulation fallback is disabled."
  );
}

function resolveSettlementProviderMode(): SettlementProviderMode {
  const rawMode = process.env.PROOVRA_SETTLEMENT_PROVIDER;

  if (rawMode === "arc-testnet") {
    return rawMode;
  }

  throw new Error(
    "PROOVRA_SETTLEMENT_PROVIDER must be arc-testnet. Simulation fallback is disabled."
  );
}

function resolvePaymentAuthorizationProviderMode(): PaymentAuthorizationProviderMode {
  const rawMode = process.env.PROOVRA_PAYMENT_PROVIDER;

  if (rawMode === "circle-cli-x402") {
    return rawMode;
  }

  throw new Error(
    "PROOVRA_PAYMENT_PROVIDER must be circle-cli-x402. Simulation fallback is disabled."
  );
}

function createProviders(): ProoVraProviders {
  const mode = resolveProviderMode();
  const settlementMode = resolveSettlementProviderMode();
  const walletMode = resolveWalletProviderMode();
  const paymentAuthorizationMode = resolvePaymentAuthorizationProviderMode();
  const settlementProvider = createArcTestnetSettlementProvider();
  const walletProvider =
    walletMode === "circle-cli"
      ? createCircleCliWalletProvider()
      : createCircleSandboxWalletProvider();
  const paymentAuthorizationProvider = createCircleCliX402PaymentAuthorizationProvider();

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
