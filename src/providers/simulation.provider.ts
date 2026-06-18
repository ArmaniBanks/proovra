import {
  simulateCreateEscrow,
  simulateCreateWallet,
  simulateSettlement,
  simulateTransfer,
} from "@/integrations/simulation";
import type {
  PaymentAuthorizationInput,
  PaymentAuthorizationResult,
  PaymentAuthorizationProvider,
  SettlementProvider,
  WalletProvider,
  WalletTransferInput,
} from "./types";

class SimulationSettlementProvider implements SettlementProvider {
  async createEscrow(input: Parameters<SettlementProvider["createEscrow"]>[0]) {
    if (process.env.PROOVRA_ALLOW_SIMULATION !== "true") {
      throw new Error("Simulated escrow is disabled. Use wallet-signed Arc Testnet settlement.");
    }
    const escrow = await simulateCreateEscrow(
      input.requesterId,
      input.providerId,
      input.amount
    );

    return {
      externalEscrowId: escrow.address,
      requesterId: escrow.buyer,
      providerId: escrow.seller,
      amount: escrow.amount,
      status: escrow.status,
    };
  }

  async releaseFunds(input: Parameters<SettlementProvider["releaseFunds"]>[0]) {
    if (process.env.PROOVRA_ALLOW_SIMULATION !== "true") {
      throw new Error("Simulated release is disabled. Use wallet-signed Arc Testnet settlement.");
    }
    return simulateSettlement(input.requesterId, input.providerId, input.amount);
  }
}

class SimulationWalletProvider implements WalletProvider {
  async createAgentWallet() {
    return simulateCreateWallet();
  }

  async transferUSDC(input: WalletTransferInput) {
    return simulateTransfer(input.from, input.to, input.amount);
  }
}

class SimulationPaymentAuthorizationProvider implements PaymentAuthorizationProvider {
  async authorizePayment(input: PaymentAuthorizationInput): Promise<PaymentAuthorizationResult> {
    void input;
    throw new Error("Simulated x402 authorization is disabled. Configure PROOVRA_PAYMENT_PROVIDER=circle-cli-x402 and execute a real Circle CLI x402 payment.");
  }

  async verifyPayment() {
    return false;
  }
}

export function createSimulationProviders() {
  return {
    settlement: new SimulationSettlementProvider(),
    wallet: new SimulationWalletProvider(),
    paymentAuthorization: new SimulationPaymentAuthorizationProvider(),
  };
}
