import { db } from "@/lib/db";
import { getProviders } from "@/providers";
import { EscrowService } from "./escrow.service";
import { ReceiptService } from "./receipt.service";
import { AgentService } from "./agent.service";
import { TaskService } from "./task.service";
import { SettlementTransactionService } from "./settlement-transaction.service";
import { areSameWallet, assertDifferentWallets } from "@/lib/wallet-validation";

export class SettlementService {
  static recordWalletRelease(input: {
    settlementId: string;
    walletAddress: string;
    txHash: string;
    blockNumber: number;
    contractAddress: string;
    explorerUrl: string;
  }) {
    const settlement = db.settlements.get(input.settlementId);
    if (!settlement) throw new Error("Settlement not found");
    const requester = db.agents.get(settlement.requesterId);
    const provider = db.agents.get(settlement.providerId);
    if (!requester) throw new Error("Requester agent not found");
    if (!provider) throw new Error("Provider agent not found");
    assertDifferentWallets(requester.walletAddress, provider.walletAddress);
    if (!areSameWallet(requester.walletAddress, input.walletAddress)) {
      throw new Error("Release must be signed by the requester wallet.");
    }
    if (settlement.escrowStatus !== "verified" || settlement.verificationResult !== "passed") {
      throw new Error("Cannot release funds: proof not verified");
    }
    const escrowProofCommitment = settlement.escrowProofCommitment ?? settlement.proofHash;
    if (!escrowProofCommitment) throw new Error("Cannot release funds without escrow proof commitment.");
    if (!settlement.externalEscrowId) throw new Error("Arc escrow id is missing.");
    if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) {
      throw new Error("Release transaction hash is required.");
    }
    if (!Number.isFinite(input.blockNumber) || input.blockNumber <= 0) {
      throw new Error("Release block number is required.");
    }

    const now = new Date();
    SettlementTransactionService.recordSettlementTransaction(input.settlementId, "arc-testnet", {
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      from: input.walletAddress,
      to: settlement.providerId,
      amount: settlement.amount,
      currency: "USDC",
      status: "confirmed",
      timestamp: now,
      settlementTime: Math.max(0, now.getTime() - settlement.createdAt.getTime()),
      provider: "arc-testnet",
      confirmationStatus: "confirmed",
      confirmations: 1,
      externalSettlementId: settlement.externalEscrowId,
      contractAddress: input.contractAddress,
    });

    const updated = EscrowService.updateEscrowStatus(input.settlementId, "released", {
      arcTxHash: input.txHash,
      releaseTxHash: input.txHash,
      releaseBlockNumber: input.blockNumber,
      releaseExplorerLink: `${input.explorerUrl.replace(/\/$/, "")}/tx/${input.txHash}`,
      contractAddress: input.contractAddress,
      settledAt: now,
      settlementTime: Math.max(0, now.getTime() - settlement.createdAt.getTime()),
    });

    TaskService.updateTaskStatus(settlement.taskId, "settled");

    if (provider && requester) {
      provider.totalEarnings += settlement.amount;
      provider.activeEscrows = Math.max(0, provider.activeEscrows - 1);
      provider.completedSettlements += 1;

      requester.totalSpending += settlement.amount;
      requester.activeEscrows = Math.max(0, requester.activeEscrows - 1);
      requester.completedSettlements += 1;

      db.agents.set(provider.id, provider);
      db.agents.set(requester.id, requester);

      AgentService.updateReputation(provider.id, true);
    }

    const receipt = ReceiptService.generateReceipt(updated);
    updated.receiptId = receipt.id;
    db.settlements.set(input.settlementId, updated);

    db.addActivity({
      type: "funds_released",
      agentId: settlement.providerId,
      description: `Arc release confirmed for escrow ${settlement.externalEscrowId}`,
      amount: settlement.amount,
    });

    return updated;
  }

  static async releaseFunds(settlementId: string) {
    if (process.env.PROOVRA_ALLOW_SIMULATION !== "true") {
      throw new Error("Server-side release is disabled. Use wallet-signed Arc Testnet release.");
    }
    const settlement = db.settlements.get(settlementId);
    if (!settlement) throw new Error("Settlement not found");
    if (settlement.escrowStatus !== "verified" || settlement.verificationResult !== "passed") {
      throw new Error("Cannot release funds: proof not verified");
    }

    const { settlement: settlementProvider, settlementMode } = getProviders();
    const transactionMetadata =
      SettlementTransactionService.getSettlementTransaction(settlementId);
    const escrowProofCommitment = settlement.escrowProofCommitment ?? settlement.proofHash;
    const arcTx = await settlementProvider.releaseFunds({
      settlementId,
      requesterId: settlement.requesterId,
      providerId: settlement.providerId,
      amount: settlement.amount,
      proofHash: escrowProofCommitment,
      externalEscrowId: transactionMetadata?.externalEscrowId,
    });
    SettlementTransactionService.recordSettlementTransaction(
      settlementId,
      settlementMode,
      arcTx
    );

    // Update Settlement State
    const updated = EscrowService.updateEscrowStatus(settlementId, "released", {
      arcTxHash: arcTx.txHash,
      settledAt: new Date(),
      settlementTime: arcTx.settlementTime
    });

    // Update Task Status
    TaskService.updateTaskStatus(settlement.taskId, "settled");

    // Update Agent Balances & Reputation
    const provider = db.agents.get(settlement.providerId);
    const requester = db.agents.get(settlement.requesterId);
    
    if (provider && requester) {
      provider.totalEarnings += settlement.amount;
      provider.activeEscrows = Math.max(0, provider.activeEscrows - 1);
      
      requester.totalSpending += settlement.amount;
      requester.activeEscrows = Math.max(0, requester.activeEscrows - 1);
      
      db.agents.set(provider.id, provider);
      db.agents.set(requester.id, requester);
      
      AgentService.updateReputation(provider.id, true);
    }

    // Generate Receipt
    const receipt = ReceiptService.generateReceipt(updated);
    updated.receiptId = receipt.id;
    db.settlements.set(settlementId, updated);

    db.addActivity({
      type: "funds_released",
      agentId: settlement.providerId,
      description: `Funds released for ${settlementId}`,
      amount: settlement.amount,
    });

    return updated;
  }
}
