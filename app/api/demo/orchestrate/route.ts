import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TaskService } from "@/services/task.service";
import { EscrowService } from "@/services/escrow.service";
import { VerificationService } from "@/services/verification.service";
import { SettlementService } from "@/services/settlement.service";
import { AgentService } from "@/services/agent.service";

// Global variable for the demo state so we can pass IDs between steps
let demoSettlementId = "";

function getWorkflowAgents() {
  const agents = AgentService.getAllAgents();
  const requester = agents.find(
    (agent) => agent.type === "requester" || agent.type === "both"
  );
  const provider = agents.find(
    (agent) => agent.type === "provider" || agent.type === "both"
  );

  if (!requester || !provider) {
    throw new Error(
      "Register requester and provider agents before running the walkthrough."
    );
  }

  return { requester, provider };
}

export async function POST(req: Request) {
  await db.ready();
  const { step } = await req.json();

  try {
    if (process.env.PROOVRA_ALLOW_SIMULATION !== "true") {
      return NextResponse.json(
        {
          error:
            "Interactive walkthrough execution is disabled. Use the wallet-signed Arc Testnet flow for real settlement.",
        },
        { status: 409 }
      );
    }

    if (step === 1) {
      const { requester, provider } = getWorkflowAgents();
      // Step 1: Agent A creates task with escrow
      const task = TaskService.createTask({
        title: "Research API Queries",
        description: "100 queries against premium academic databases.",
        requesterId: requester.id,
        providerId: provider.id,
        amount: 0.001,
        pricingModel: "per-call",
        deliverables: "JSON results",
        verificationCriteria: "All queries return valid results",
        deadline: new Date(Date.now() + 86400000),
      });
      // Escrow funded
      const settlement = await EscrowService.lockFunds(
        task.id,
        task.requesterId,
        provider.id,
        task.amount,
        task.pricingModel
      );
      demoSettlementId = settlement.id;
      await db.flush();
      
      return NextResponse.json({ success: true, task, settlement });
    }

    if (step === 2) {
      // Step 2: Agent B delivers work + proof
      if (!demoSettlementId) throw new Error("No active demo settlement");
      const proofHash = VerificationService.submitProof(demoSettlementId, {
        proofText: "Demo workflow proof: provider returned valid research API results.",
      });
      await db.flush();
      return NextResponse.json({ success: true, proofHash });
    }

    if (step === 3) {
      // Step 3: ProoVra verifies delivery
      if (!demoSettlementId) throw new Error("No active demo settlement");
      const passed = await VerificationService.verifyDelivery(demoSettlementId);
      await db.flush();
      return NextResponse.json({ success: true, passed });
    }

    if (step === 4) {
      // Step 4: Funds release + receipt generated
      if (!demoSettlementId) throw new Error("No active demo settlement");
      const settlement = await SettlementService.releaseFunds(demoSettlementId);
      await db.flush();
      return NextResponse.json({ success: true, settlement });
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workflow orchestration failed" },
      { status: 500 }
    );
  }
}
