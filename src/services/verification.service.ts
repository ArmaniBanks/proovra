import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { ProofFile } from "@/lib/mock-data";
import { areSameWallet, assertDifferentWallets } from "@/lib/wallet-validation";
import { EscrowService } from "./escrow.service";
import { TaskService } from "./task.service";

type ProofSubmission = {
  proofHash?: string;
  proofUrl?: string;
  proofText?: string;
  proofFile?: ProofFile;
  submitterWallet?: string;
};

function normalizeProofHash(input: ProofSubmission) {
  if (input.proofHash && /^0x[a-fA-F0-9]{64}$/.test(input.proofHash)) {
    return input.proofHash;
  }

  const proofMaterial = [
    input.proofUrl,
    input.proofText,
    input.proofFile?.fileHash,
    input.proofFile?.fileName,
    input.proofFile?.fileUrl,
  ]
    .filter(Boolean)
    .join("\n");
  if (!proofMaterial.trim()) {
    throw new Error("Submit proof text, a proof URL, or an uploaded proof file before verification.");
  }

  return `0x${createHash("sha256").update(proofMaterial).digest("hex")}`;
}

export class VerificationService {
  static submitProof(settlementId: string, proof: ProofSubmission): string {
    const settlement = db.settlements.get(settlementId);
    if (!settlement) throw new Error("Settlement not found");
    const requester = db.agents.get(settlement.requesterId);
    const provider = db.agents.get(settlement.providerId);
    if (!requester) throw new Error("Requester agent not found");
    if (!provider) throw new Error("Provider agent not found");
    assertDifferentWallets(requester.walletAddress, provider.walletAddress);
    if (!areSameWallet(provider.walletAddress, proof.submitterWallet)) {
      throw new Error("Proof must be submitted by the provider wallet.");
    }
    const hasProofSource = Boolean(
      proof.proofText?.trim() || proof.proofUrl?.trim() || proof.proofFile?.fileUrl
    );
    if (!hasProofSource) {
      throw new Error("Submit proof text, a proof URL, or an uploaded proof file.");
    }

    const submittedProofHash = normalizeProofHash(proof);
    EscrowService.updateEscrowStatus(settlementId, "submitted", {
      // Provider evidence is review metadata. It must not replace the
      // original on-chain escrow proof commitment needed by releaseAfterProof.
      escrowProofCommitment: settlement.escrowProofCommitment || settlement.proofHash,
      proofHash: settlement.proofHash,
      submittedProofEvidenceHash: submittedProofHash,
      proofUrl: proof.proofUrl,
      proofText: proof.proofText,
      proofFile: proof.proofFile,
      proofSubmittedAt: new Date(),
    });
    TaskService.updateTaskStatus(settlement.taskId, "delivered");
    return submittedProofHash;
  }

  static verifyDelivery(settlementId: string, verifier?: string, approved = false): boolean {
    const settlement = db.settlements.get(settlementId);
    if (!settlement) throw new Error("Settlement not found");
    if (!settlement.proofHash) throw new Error("Cannot verify before proof is submitted.");
    if (settlement.escrowStatus !== "submitted") {
      throw new Error("Proof must be submitted before approval.");
    }
    if (!settlement.proofText?.trim() && !settlement.proofUrl?.trim() && !settlement.proofFile?.fileUrl) {
      throw new Error("Proof text, proof URL, or uploaded proof file is required before approval.");
    }
    if (!approved) {
      throw new Error("Verifier approval is required.");
    }
    if (!verifier || !/^0x[a-fA-F0-9]{40}$/.test(verifier)) {
      throw new Error("Verifier wallet address is required.");
    }
    const requester = db.agents.get(settlement.requesterId);
    const provider = db.agents.get(settlement.providerId);
    if (!requester) throw new Error("Requester agent not found");
    if (!provider) throw new Error("Provider agent not found");
    assertDifferentWallets(requester.walletAddress, provider.walletAddress);
    if (!areSameWallet(requester.walletAddress, verifier)) {
      throw new Error("Proof must be approved by the requester wallet.");
    }

    EscrowService.updateEscrowStatus(settlementId, "verified", {
      verificationResult: "passed",
      verifiedAt: new Date(),
      verifiedBy: verifier,
    });
    TaskService.updateTaskStatus(settlement.taskId, "verified");

    db.addActivity({
      type: "verification_passed",
      agentId: settlement.requesterId,
      description: `Verifier approved proof for ${settlementId}`,
    });

    return true;
  }
}
