// ============================================================
// ProoVra — Simulation Layer
// Mirrors Arc/Circle settlement flow for local dev and demo mode
// This layer is the active provider in Phase 1 and Phase 2
// ============================================================

/**
 * The simulation layer provides the same interfaces as the live
 * Arc/Circle integrations, but uses mock data and local state.
 * It can be swapped with live integrations without changing the UI.
 *
 * Used for:
 * - Local development
 * - Demo mode
 * - Fallback when testnet services are unavailable
 */

import type { ArcTransaction, ArcEscrowContract } from "../arc";
import type { CircleWallet, CircleTransfer } from "../circle";
import type { X402PaymentResponse } from "../x402";

let nextTxId = 1000;

export async function simulateSettlement(
  from: string,
  to: string,
  amount: number
): Promise<ArcTransaction> {
  // Simulate sub-500ms settlement
  const settlementTime = 250 + Math.random() * 200;
  await new Promise((resolve) => setTimeout(resolve, settlementTime));

  return {
    txHash: `0xarc_sim_${(nextTxId++).toString(16).padStart(8, "0")}`,
    blockNumber: 2848000 + nextTxId,
    from,
    to,
    amount,
    currency: "USDC",
    status: "confirmed",
    timestamp: new Date(),
    settlementTime: Math.round(settlementTime),
  };
}

export async function simulateCreateEscrow(
  buyer: string,
  seller: string,
  amount: number
): Promise<ArcEscrowContract> {
  return {
    address: `0xescrow_${(nextTxId++).toString(16).padStart(8, "0")}`,
    buyer,
    seller,
    amount,
    status: "locked",
  };
}

export async function simulateCreateWallet(): Promise<CircleWallet> {
  return {
    id: `wallet_${(nextTxId++).toString(16)}`,
    address: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    balance: 1000.0,
    currency: "USDC",
    chain: "arc",
  };
}

export async function simulateTransfer(
  from: string,
  to: string,
  amount: number
): Promise<CircleTransfer> {
  return {
    id: `transfer_${(nextTxId++).toString(16)}`,
    from,
    to,
    amount,
    currency: "USDC",
    status: "completed",
    timestamp: new Date(),
  };
}

export async function simulateX402Payment(
  amount: number
): Promise<X402PaymentResponse> {
  void amount;
  throw new Error("Simulated x402 payment success is disabled. Configure Circle CLI x402 for paid authorization.");
}
