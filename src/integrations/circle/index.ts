// ============================================================
// ProoVra — Circle Integration Layer (Stub)
// Phase 1: Mock implementation
// Phase 3: Replace with live Circle integration
// ============================================================

/**
 * Circle integration handles:
 * - Agent wallets (creation, management)
 * - USDC balances
 * - Transfers
 * - Payment execution
 *
 * Uses Circle CLI: npm install -g @circle-fin/cli
 * Docs: https://developers.circle.com/agent-stack
 */

export interface CircleWallet {
  id: string;
  address: string;
  balance: number;
  currency: "USDC" | "EURC";
  chain: "arc" | "ethereum" | "polygon";
}

export interface CircleTransfer {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: "USDC";
  status: "pending" | "completed" | "failed";
  timestamp: Date;
}

// Stub functions — will be replaced with live Circle integration in Phase 3
export async function createAgentWallet(): Promise<CircleWallet> {
  throw new Error("Configure the Circle CLI wallet provider before creating agent wallets.");
}

export async function getWalletBalance(): Promise<number> {
  throw new Error("Configure the Circle CLI wallet provider before reading wallet balances.");
}

export async function transferUSDC(): Promise<CircleTransfer> {
  throw new Error("Configure the Circle CLI wallet provider before transferring USDC.");
}

export async function getTransferHistory(): Promise<CircleTransfer[]> {
  throw new Error("Configure the Circle CLI wallet provider before reading transfer history.");
}
