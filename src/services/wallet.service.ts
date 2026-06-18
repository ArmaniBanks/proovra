import { db, type AgentWalletRecord } from "@/lib/db";
import { getProviders } from "@/providers";

export class WalletService {
  static getAgentWallet(agentId: string): AgentWalletRecord | undefined {
    return db.wallets.get(agentId);
  }

  static getAllWallets(): AgentWalletRecord[] {
    return Array.from(db.wallets.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  static async createAgentWallet(agentId: string): Promise<AgentWalletRecord> {
    const agent = db.agents.get(agentId);
    if (!agent) throw new Error("Agent not found");

    const existingWallet = db.wallets.get(agentId);
    if (existingWallet) return existingWallet;

    const providers = getProviders();
    const wallet = await providers.wallet.createAgentWallet({ agentId });
    const now = new Date();

    const walletRecord: AgentWalletRecord = {
      ...wallet,
      agentId,
      provider: providers.walletMode,
      status: wallet.status ?? "created",
      createdAt: now,
      updatedAt: now,
    };

    db.wallets.set(agentId, walletRecord);
    return walletRecord;
  }
}
