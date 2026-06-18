import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ReadModelService } from "@/services/read-model.service";

export async function GET() {
  await db.ready();
  return NextResponse.json({
    stats: ReadModelService.getDashboardStats(),
    activities: ReadModelService.getActivities(),
    recentSettlements: ReadModelService.getSettlements().slice(0, 8),
    agentsById: ReadModelService.getAgentMap(),
    dataSource: ReadModelService.getDataSourceSummary(),
  });
}
