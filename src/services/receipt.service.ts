import { db } from "@/lib/db";
import { generateShortId } from "@/lib/utils";
import type { Receipt, Settlement } from "@/lib/mock-data";
import { assertDifferentWallets } from "@/lib/wallet-validation";
import { SettlementTransactionService } from "./settlement-transaction.service";

export class ReceiptService {
  static generateReceipt(settlement: Settlement): Receipt {
    const transaction = SettlementTransactionService.getSettlementTransaction(settlement.id);
    const explorer = process.env.ARC_TESTNET_EXPLORER_URL || "https://testnet.arcscan.app";
    const explorerBase = explorer.replace(/\/$/, "");
    const escrowTxHash = settlement.escrowTxHash ?? transaction?.createTxHash;
    const releaseTxHash = settlement.releaseTxHash ?? transaction?.releaseTxHash;
    const releaseBlockNumber = settlement.releaseBlockNumber ?? transaction?.releaseBlockNumber;
    const requester = db.agents.get(settlement.requesterId);
    const provider = db.agents.get(settlement.providerId);

    if (settlement.escrowStatus !== "released") {
      throw new Error("Receipt cannot be generated before payment release.");
    }
    if (!settlement.proofHash || !settlement.verifiedAt || !settlement.verifiedBy) {
      throw new Error("Receipt requires verified proof metadata.");
    }
    if (!escrowTxHash || !settlement.escrowExplorerLink) {
      throw new Error("Receipt requires confirmed escrow transaction metadata.");
    }
    if (!releaseTxHash || !releaseBlockNumber) {
      throw new Error("Receipt requires confirmed release transaction metadata.");
    }
    if (!requester || !provider) {
      throw new Error("Receipt requires requester and provider agent records.");
    }
    assertDifferentWallets(requester.walletAddress, provider.walletAddress);

    const explorerLink = settlement.arcTxHash
      ? `${explorerBase}/tx/${settlement.arcTxHash}`
      : undefined;
    const receipt: Receipt = {
      id: generateShortId().replace("PV-", "rcp-"),
      settlementId: settlement.id,
      taskId: settlement.taskId,
      requesterId: settlement.requesterId,
      providerId: settlement.providerId,
      amount: settlement.amount,
      proofHash: settlement.proofHash,
      proofUrl: settlement.proofUrl,
      proofText: settlement.proofText,
      proofFile: settlement.proofFile,
      verificationTimestamp: settlement.verifiedAt,
      arcTxHash: settlement.arcTxHash,
      escrowTxHash,
      releaseTxHash,
      explorerLink,
      escrowExplorerLink:
        settlement.escrowExplorerLink ??
        (escrowTxHash ? `${explorerBase}/tx/${escrowTxHash}` : undefined),
      releaseExplorerLink:
        settlement.releaseExplorerLink ??
        (releaseTxHash ? `${explorerBase}/tx/${releaseTxHash}` : undefined),
      blockNumber: releaseBlockNumber,
      settlementTime: settlement.settlementTime ?? transaction?.settlementTime ?? 0,
      settlementTimestamp: settlement.settledAt,
      createdAt: new Date(),
    };

    db.receipts.set(receipt.id, receipt);

    db.addActivity({
      type: "receipt_generated",
      agentId: settlement.providerId,
      description: `Receipt ${receipt.id} generated on Arc`,
      amount: settlement.amount,
    });

    return receipt;
  }
}
