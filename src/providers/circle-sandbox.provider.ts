import { createHash, randomUUID } from "node:crypto";
import type {
  AgentWallet,
  AgentWalletCreateInput,
  WalletProvider,
  WalletTransferResult,
} from "./types";

function createSandboxAddress(agentId: string) {
  const hash = createHash("sha256")
    .update(`circle-sandbox:${agentId}:${randomUUID()}`)
    .digest("hex");

  return `0x${hash.slice(0, 40)}`;
}

class CircleSandboxWalletProvider implements WalletProvider {
  async createAgentWallet(input: AgentWalletCreateInput): Promise<AgentWallet> {
    const walletId = `circle_sandbox_${randomUUID()}`;

    return {
      id: walletId,
      externalId: walletId,
      agentId: input.agentId,
      address: createSandboxAddress(input.agentId),
      balance: 0,
      currency: "USDC",
      chain: "arc",
      provider: "circle-sandbox",
      status: "created",
    };
  }

  async transferUSDC(): Promise<WalletTransferResult> {
    throw new Error("Circle Sandbox wallet transfers are disabled in this milestone.");
  }
}

export function createCircleSandboxWalletProvider(): WalletProvider {
  return new CircleSandboxWalletProvider();
}
