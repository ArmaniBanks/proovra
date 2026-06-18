import { db, type SettlementTransactionRecord } from "@/lib/db";
import type {
  EscrowCreateResult,
  SettlementProviderMode,
  SettlementReleaseResult,
} from "@/providers";

export class SettlementTransactionService {
  static recordEscrowCreation(
    settlementId: string,
    provider: SettlementProviderMode,
    transaction: EscrowCreateResult
  ): SettlementTransactionRecord | undefined {
    if (!transaction.txHash) return undefined;

    const now = new Date();
    const confirmationStatus = transaction.confirmationStatus ?? "submitted";
    const record: SettlementTransactionRecord = {
      settlementId,
      provider,
      contractAddress: transaction.contractAddress,
      externalEscrowId: transaction.externalEscrowId,
      createTxHash: transaction.txHash,
      createBlockNumber: transaction.blockNumber,
      createConfirmationStatus: confirmationStatus,
      createConfirmations: transaction.confirmations,
      createSettlementTime: transaction.settlementTime,
      txHash: transaction.txHash,
      blockNumber: transaction.blockNumber ?? 0,
      from: transaction.requesterId,
      to: transaction.providerId,
      amount: transaction.amount,
      currency: "USDC",
      status: confirmationStatus === "failed" ? "failed" : "pending",
      confirmationStatus,
      confirmations: transaction.confirmations ?? 0,
      settlementTime: transaction.settlementTime ?? 0,
      submittedAt: now,
      confirmedAt: confirmationStatus === "confirmed" ? now : undefined,
      updatedAt: now,
    };

    db.settlementTransactions.set(settlementId, record);
    return record;
  }

  static recordSettlementTransaction(
    settlementId: string,
    provider: SettlementProviderMode,
    transaction: SettlementReleaseResult
  ): SettlementTransactionRecord {
    const now = new Date();
    const confirmationStatus =
      transaction.confirmationStatus ??
      (transaction.status === "confirmed" ? "confirmed" : "submitted");

    const existing = db.settlementTransactions.get(settlementId);
    const record: SettlementTransactionRecord = {
      ...existing,
      settlementId,
      provider,
      contractAddress: transaction.contractAddress ?? existing?.contractAddress,
      releaseTxHash: transaction.txHash,
      releaseBlockNumber: transaction.blockNumber,
      txHash: transaction.txHash,
      blockNumber: transaction.blockNumber,
      from: transaction.from,
      to: transaction.to,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      confirmationStatus,
      confirmations: transaction.confirmations ?? (transaction.status === "confirmed" ? 1 : 0),
      settlementTime: transaction.settlementTime,
      submittedAt: transaction.timestamp,
      confirmedAt: confirmationStatus === "confirmed" ? now : undefined,
      updatedAt: now,
    };

    db.settlementTransactions.set(settlementId, record);
    return record;
  }

  static getSettlementTransaction(settlementId: string) {
    return db.settlementTransactions.get(settlementId);
  }
}
