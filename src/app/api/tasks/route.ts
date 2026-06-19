import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TaskService } from "@/services/task.service";
import { ReadModelService } from "@/services/read-model.service";
import { AgentService } from "@/services/agent.service";
import type { PricingModel, TaskStatus } from "@/lib/mock-data";

const pricingModels: PricingModel[] = [
  "per-task",
  "per-call",
  "per-second",
  "per-byte",
  "milestone",
];
const taskStatuses: TaskStatus[] = [
  "created",
  "assigned",
  "in-progress",
  "delivered",
  "verified",
  "settled",
  "failed",
];

export async function GET() {
  await db.ready();
  const removedAgents = AgentService.pruneUnusedDuplicateAgents();
  if (removedAgents > 0) {
    await db.flush();
  }

  return NextResponse.json({
    tasks: TaskService.getAllTasks(),
    agentsById: ReadModelService.getAgentMap(),
    dataSource: ReadModelService.getDataSourceSummary(),
  });
}

export async function POST(req: Request) {
  await db.ready();
  const body = await req.json();

  if (
    typeof body.title !== "string" ||
    typeof body.description !== "string" ||
    typeof body.requesterId !== "string" ||
    (body.providerId !== undefined && typeof body.providerId !== "string") ||
    typeof body.amount !== "number" ||
    typeof body.pricingModel !== "string" ||
    typeof body.deliverables !== "string" ||
    typeof body.verificationCriteria !== "string"
  ) {
    return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
  }

  if (!pricingModels.includes(body.pricingModel as PricingModel)) {
    return NextResponse.json({ error: "Invalid pricing model" }, { status: 400 });
  }

  const deadline = new Date(body.deadline);
  if (Number.isNaN(deadline.getTime())) {
    return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
  }

  try {
    const task = TaskService.createTask({
      title: body.title,
      description: body.description,
      requesterId: body.requesterId,
      providerId: body.providerId,
      amount: body.amount,
      pricingModel: body.pricingModel as PricingModel,
      deliverables: body.deliverables,
      verificationCriteria: body.verificationCriteria,
      deadline,
    });
    await db.flush();
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task creation failed" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  await db.ready();
  const body = await req.json();

  if (typeof body.taskId !== "string") {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  if (body.action === "accept-task") {
    if (typeof body.walletAddress !== "string") {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    try {
      const task = TaskService.acceptTask(body.taskId, body.walletAddress);
      await db.flush();
      return NextResponse.json({ task });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Task acceptance failed" },
        { status: 400 }
      );
    }
  }

  if (typeof body.status !== "string") {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  if (!taskStatuses.includes(body.status as TaskStatus)) {
    return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
  }

  try {
    const task = TaskService.updateTaskStatus(body.taskId, body.status as TaskStatus);
    await db.flush();
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Task update failed" },
      { status: 400 }
    );
  }
}
