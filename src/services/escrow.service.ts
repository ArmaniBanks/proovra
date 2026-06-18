import { db } from "@/lib/db";
import { getProviders } from "@/providers";
import type { PricingModel, Settlement } from "@/lib/mock-data";
import { generateHash, generateShortId } from "@/lib/utils";
import { assertDifferentWallets, areSameWallet } from "@/lib/wallet-validation";
import { SettlementTransactionService } from "./settlement-transaction.service";
import { TaskService } from "./task.service";

export class EscrowService {
  static recordWalletFundedEscrow(input: {
    taskId: string;
    requesterId: string;
    providerId: string;
    amount: number;
    pricingModel: PricingModel;
    proofHash: string;
    walletAddress: string;
    txHash: string;
    blockNumber: number;
    externalEscrowId: string;
    contractAddress: string;
    explorerUrl: string;
  }): Settlement {
    const task = db.tasks.get(input.taskId);
    if (!task) throw new Error("Task not found");
    if (!task.providerId) throw new Error("Task must be accepted by a provider before escrow funding.");
    const requester = db.agents.get(input.requesterId);
    const provider = db.agents.get(input.providerId);
    if (!requester) throw new Error("Requester agent not found");
    if (!provider) throw new Error("Provider agent not found");
    if (task.requesterId !== input.requesterId || task.providerId !== input.providerId) {
      throw new Error("Settlement parties do not match task parties");
    }
    assertDifferentWallets(requester.walletAddress, provider.walletAddress);
    if (!areSameWallet(requester.walletAddress, input.walletAddress)) {
      throw new Error("Escrow must be funded by the requester wallet.");
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(input.proofHash)) {
      throw new Error("Proof hash commitment must be a 32-byte hex value.");
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) {
      throw new Error("Escrow transaction hash is required.");
    }
    if (!Number.isFinite(input.blockNumber) || input.blockNumber <= 0) {
      throw new Error("Escrow block number is required.");
    }

    const settlementId = generateShortId().replace("PV-", "stl-");
    const now = new Date();
    const settlement: Settlement = {
      id: settlementId,
      taskId: input.taskId,
      requesterId: input.requesterId,
      providerId: input.providerId,
      amount: input.amount,
      escrowStatus: "funded",
      proofHash: input.proofHash,
      verificationResult: "pending",
      arcTxHash: input.txHash,
      escrowTxHash: input.txHash,
      escrowBlockNumber: input.blockNumber,
      escrowExplorerLink: `${input.explorerUrl.replace(/\/$/, "")}/tx/${input.txHash}`,
      externalEscrowId: input.externalEscrowId,
      contractAddress: input.contractAddress,
      createdAt: now,
      pricingModel: input.pricingModel,
    };

    db.settlements.set(settlement.id, settlement);
    SettlementTransactionService.recordEscrowCreation(settlement.id, "arc-testnet", {
      externalEscrowId: input.externalEscrowId,
      requesterId: input.requesterId,
      providerId: input.providerId,
      amount: input.amount,
      status: "locked",
      provider: "arc-testnet",
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      confirmationStatus: "confirmed",
      confirmations: 1,
      contractAddress: input.contractAddress,
      settlementTime: 0,
    });

    db.addActivity({
      type: "escrow_funded",
      agentId: input.requesterId,
      description: `Arc escrow ${input.externalEscrowId} funded for task ${input.taskId}`,
      amount: input.amount,
    });

    if (requester) {
      requester.activeEscrows += 1;
      db.agents.set(requester.id, requester);
    }
    if (provider) {
      provider.activeEscrows += 1;
      db.agents.set(provider.id, provider);
    }

    TaskService.updateTaskStatus(input.taskId, "assigned");
    return settlement;
  }

  static async lockFunds(taskId: string, requesterId: string, providerId: string, amount: number, pricingModel: PricingModel): Promise<Settlement> {
    if (process.env.PROOVRA_ALLOW_SIMULATION !== "true") {
      throw new Error("Server-side escrow funding is disabled. Use wallet-signed Arc Testnet funding.");
    }
    const task = db.tasks.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.providerId) throw new Error("Task must be accepted by a provider before escrow funding.");
    const requester = db.agents.get(requesterId);
    const provider = db.agents.get(providerId);
    if (!requester) throw new Error("Requester agent not found");
    if (!provider) throw new Error("Provider agent not found");
    if (task.requesterId !== requesterId || task.providerId !== providerId) {
      throw new Error("Settlement parties do not match task parties");
    }
    assertDifferentWallets(requester.walletAddress, provider.walletAddress);

    const settlementId = generateShortId().replace("PV-", "stl-");
    const { settlement: settlementProvider, settlementMode } = getProviders();
    const proofHash = settlementMode === "arc-testnet" ? generateHash() : "";
    const escrowResult = await settlementProvider.createEscrow({
      settlementId,
      taskId,
      requesterId,
      providerId,
      amount,
      pricingModel,
      proofHash,
    });
    SettlementTransactionService.recordEscrowCreation(
      settlementId,
      settlementMode,
      escrowResult
    );

    const settlement: Settlement = {
      id: settlementId,
      taskId,
      requesterId,
      providerId,
      amount,
      escrowStatus: "funded",
      proofHash,
      verificationResult: "pending",
      arcTxHash: "",
      createdAt: new Date(),
      pricingModel
    };

    db.settlements.set(settlement.id, settlement);
    
    db.addActivity({
      type: "escrow_funded",
      agentId: requesterId,
      description: `Escrow funded for task ${taskId}`,
      amount
    });
    TaskService.updateTaskStatus(taskId, "assigned");

    return settlement;
  }

  static updateEscrowStatus(settlementId: string, status: Settlement["escrowStatus"], extraData?: Partial<Settlement>) {
    const settlement = db.settlements.get(settlementId);
    if (!settlement) throw new Error("Settlement not found");

    Object.assign(settlement, { escrowStatus: status, ...extraData });
    db.settlements.set(settlementId, settlement);

    if (status === "submitted") {
      db.addActivity({
        type: "work_submitted",
        agentId: settlement.providerId,
        description: `Work and proof submitted for ${settlementId}`,
      });
    }

    return settlement;
  }
}
