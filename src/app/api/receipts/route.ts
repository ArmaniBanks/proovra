import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ReadModelService } from "@/services/read-model.service";

export async function GET() {
  await db.ready();
  return NextResponse.json({
    receipts: ReadModelService.getReceipts(),
    agentsById: ReadModelService.getAgentMap(),
    tasksById: ReadModelService.getTaskMap(),
    dataSource: ReadModelService.getDataSourceSummary(),
  });
}
