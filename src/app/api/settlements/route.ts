import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EscrowService } from "@/services/escrow.service";
import { ReadModelService } from "@/services/read-model.service";
import { SettlementService } from "@/services/settlement.service";
import { VerificationService } from "@/services/verification.service";
import type { PricingModel } from "@/lib/mock-data";
import { areSameWallet } from "@/lib/wallet-validation";
import { getGitHubPullRequestEvidence } from "@/integrations/github";

const pricingModels: PricingModel[] = [
  "per-task",
  "per-call",
  "per-second",
  "per-byte",
  "milestone",
];

export async function GET() {
  await db.ready();
  const settlements = ReadModelService.getSettlements();
  const tasksById = ReadModelService.getTaskMap();
  const agentsById = ReadModelService.getAgentMap();
  const settledTaskIds = new Set(settlements.map((settlement) => settlement.taskId));
  const fundableTasks = Object.values(tasksById).filter(
    (task) =>
      !settledTaskIds.has(task.id) &&
      task.status !== "settled" &&
      task.status !== "failed" &&
      Boolean(task.providerId) &&
      !areSameWallet(
        agentsById[task.requesterId]?.walletAddress,
        task.providerId ? agentsById[task.providerId]?.walletAddress : undefined
      )
  );

  return NextResponse.json({
    settlements,
    agentsById,
    tasksById,
    fundableTasks,
    dataSource: ReadModelService.getDataSourceSummary(),
  });
}

export async function POST(req: Request) {
  await db.ready();
  const body = await req.json();

  if (
    typeof body.taskId !== "string" ||
    typeof body.requesterId !== "string" ||
    typeof body.providerId !== "string" ||
    typeof body.amount !== "number" ||
    typeof body.pricingModel !== "string" ||
    typeof body.proofHash !== "string" ||
    typeof body.walletAddress !== "string" ||
    typeof body.txHash !== "string" ||
    typeof body.blockNumber !== "number" ||
    typeof body.externalEscrowId !== "string" ||
    typeof body.contractAddress !== "string" ||
    typeof body.explorerUrl !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid Arc wallet settlement payload" },
      { status: 400 }
    );
  }

  if (!pricingModels.includes(body.pricingModel as PricingModel)) {
    return NextResponse.json({ error: "Invalid pricing model" }, { status: 400 });
  }

  try {
    const settlement = EscrowService.recordWalletFundedEscrow({
      taskId: body.taskId,
      requesterId: body.requesterId,
      providerId: body.providerId,
      amount: body.amount,
      pricingModel: body.pricingModel as PricingModel,
      proofHash: body.proofHash,
      walletAddress: body.walletAddress,
      txHash: body.txHash,
      blockNumber: body.blockNumber,
      externalEscrowId: body.externalEscrowId,
      contractAddress: body.contractAddress,
      explorerUrl: body.explorerUrl,
    });
    await db.flush();
    return NextResponse.json({ settlement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settlement creation failed" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  await db.ready();
  const body = await req.json();

  if (typeof body.settlementId !== "string" || typeof body.action !== "string") {
    return NextResponse.json({ error: "settlementId and action are required" }, { status: 400 });
  }

  try {
    if (body.action === "submit-proof") {
      const currentSettlement = db.settlements.get(body.settlementId);
      if (!currentSettlement) {
        throw new Error("Settlement not found");
      }
      const task = db.tasks.get(currentSettlement.taskId);
      const proofUrl =
        typeof body.proofUrl === "string" && body.proofUrl.trim()
          ? body.proofUrl.trim()
          : undefined;
      const githubPullRequest =
        task?.source?.platform === "github" && proofUrl
          ? await getGitHubPullRequestEvidence(proofUrl, task.source)
          : undefined;

      VerificationService.submitProof(body.settlementId, {
        proofHash: typeof body.proofHash === "string" ? body.proofHash : undefined,
        proofUrl,
        proofText: typeof body.proofText === "string" ? body.proofText : undefined,
        proofFile:
          body.proofFile && typeof body.proofFile === "object"
            ? {
                fileName: String(body.proofFile.fileName ?? ""),
                fileType: String(body.proofFile.fileType ?? ""),
                fileSize: Number(body.proofFile.fileSize ?? 0),
                uploadedAt: new Date(body.proofFile.uploadedAt ?? Date.now()),
                fileUrl: String(body.proofFile.fileUrl ?? ""),
                filePath: String(body.proofFile.filePath ?? ""),
                fileHash:
                  typeof body.proofFile.fileHash === "string"
                    ? body.proofFile.fileHash
                    : undefined,
              }
            : undefined,
        githubPullRequest,
        submitterWallet: typeof body.walletAddress === "string" ? body.walletAddress : undefined,
      });
      const settlement = ReadModelService.getSettlements().find(
        (candidate) => candidate.id === body.settlementId
      );
      await db.flush();
      return NextResponse.json({ settlement });
    }

    if (body.action === "verify-proof") {
      VerificationService.verifyDelivery(
        body.settlementId,
        typeof body.verifier === "string" ? body.verifier : undefined,
        body.approved === true
      );
      const settlement = ReadModelService.getSettlements().find(
        (candidate) => candidate.id === body.settlementId
      );
      await db.flush();
      return NextResponse.json({ settlement });
    }

    if (body.action === "release-payment") {
      if (
        typeof body.walletAddress !== "string" ||
        typeof body.txHash !== "string" ||
        typeof body.blockNumber !== "number" ||
        typeof body.contractAddress !== "string" ||
        typeof body.explorerUrl !== "string"
      ) {
        return NextResponse.json(
          { error: "Arc release transaction metadata is required" },
          { status: 400 }
        );
      }
      const settlement = SettlementService.recordWalletRelease({
        settlementId: body.settlementId,
        walletAddress: body.walletAddress,
        txHash: body.txHash,
        blockNumber: body.blockNumber,
        contractAddress: body.contractAddress,
        explorerUrl: body.explorerUrl,
      });
      await db.flush();
      return NextResponse.json({ settlement });
    }

    return NextResponse.json({ error: "Invalid settlement action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settlement action failed" },
      { status: 400 }
    );
  }
}
