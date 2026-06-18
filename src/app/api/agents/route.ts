import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AgentService } from "@/services/agent.service";
import { ReadModelService } from "@/services/read-model.service";
import type { AgentRole, AgentType } from "@/lib/mock-data";

const agentRoles: AgentRole[] = [
  "research",
  "writer",
  "editor",
  "publisher",
  "data",
  "voice",
  "security",
  "orchestrator",
];
const agentTypes: AgentType[] = ["provider", "requester", "both"];

export async function GET() {
  await db.ready();
  return NextResponse.json({
    agents: AgentService.getAllAgents(),
    dataSource: ReadModelService.getDataSourceSummary(),
  });
}

export async function POST(req: Request) {
  await db.ready();
  const body = await req.json();

  if (
    typeof body.name !== "string" ||
    typeof body.role !== "string" ||
    typeof body.type !== "string" ||
    typeof body.description !== "string" ||
    typeof body.walletAddress !== "string"
  ) {
    return NextResponse.json({ error: "Invalid agent payload" }, { status: 400 });
  }

  if (!agentRoles.includes(body.role as AgentRole)) {
    return NextResponse.json({ error: "Invalid agent role" }, { status: 400 });
  }

  if (!agentTypes.includes(body.type as AgentType)) {
    return NextResponse.json({ error: "Invalid agent type" }, { status: 400 });
  }

  try {
    const agent = AgentService.registerAgent({
      name: body.name,
      role: body.role as AgentRole,
      type: body.type as AgentType,
      description: body.description,
      walletAddress: body.walletAddress,
      avatar: typeof body.avatar === "string" ? body.avatar : undefined,
    });
    await db.flush();

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent registration failed" },
      { status: 400 }
    );
  }
}
