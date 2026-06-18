import { NextResponse } from "next/server";
import { ReadModelService } from "@/services/read-model.service";

export async function GET() {
  return NextResponse.json({
    receipts: ReadModelService.getReceipts(),
    agentsById: ReadModelService.getAgentMap(),
    tasksById: ReadModelService.getTaskMap(),
    dataSource: ReadModelService.getDataSourceSummary(),
  });
}
