// ============================================================
// ProoVra — Arc Integration Layer (Stub)
// Phase 1: Mock implementation
// Phase 3: Replace with live Arc testnet integration
// ============================================================

/**
 * Arc integration handles:
 * - Escrow settlement transactions
 * - Settlement receipts
 * - Transaction history
 * - Payment release events
 *
 * Uses ARC CLI: uv tool install git+https://github.com/the-canteen-dev/ARC-cli
 * Docs: https://docs.arc.network
 */

export interface ArcTransaction {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  amount: number;
  currency: "USDC";
  status: "pending" | "confirmed" | "failed";
  timestamp: Date;
  settlementTime: number; // ms
}

export interface ArcEscrowContract {
  address: string;
  buyer: string;
  seller: string;
  amount: number;
  status: "locked" | "released" | "refunded";
}

// Stub functions — will be replaced with live Arc integration in Phase 3
export async function submitSettlement(): Promise<ArcTransaction> {
  // TODO: Phase 3 — integrate with Arc testnet
  throw new Error("Use the wallet-signed Arc Testnet settlement flow.");
}

export async function getTransactionHistory(): Promise<ArcTransaction[]> {
  throw new Error("Use persisted Arc Testnet settlement records.");
}

export async function createEscrow(): Promise<ArcEscrowContract> {
  throw new Error("Use wallet-signed createEscrow on Arc Testnet.");
}

export async function releaseEscrow(): Promise<ArcTransaction> {
  throw new Error("Use wallet-signed releaseAfterProof on Arc Testnet.");
}
