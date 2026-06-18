import { db } from "@/lib/db";
import type { Agent, DashboardStats, Receipt, Settlement, Task } from "@/lib/mock-data";

const TERMINAL_SETTLEMENTS = new Set<Settlement["escrowStatus"]>([
  "released",
  "refunded",
  "failed",
]);

function releasedSettlements() {
  return Array.from(db.settlements.values()).filter(
    (settlement) => settlement.escrowStatus === "released"
  );
}

function completedSettlements() {
  return Array.from(db.settlements.values()).filter((settlement) =>
    TERMINAL_SETTLEMENTS.has(settlement.escrowStatus)
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function successRateFor(settlements: Settlement[]) {
  if (settlements.length === 0) return 0;
  const successful = settlements.filter(
    (settlement) =>
      settlement.escrowStatus === "released" &&
      settlement.verificationResult === "passed"
  ).length;
  return (successful / settlements.length) * 100;
}

function reputationFromActivity(successRate: number, completedCount: number) {
  if (completedCount === 0) return 0;
  const volumeBonus = Math.min(10, Math.log10(completedCount + 1) * 5);
  return Math.min(100, Math.max(0, successRate * 0.9 + volumeBonus));
}

export class ReadModelService {
  static getAgents(): Agent[] {
    const settlements = Array.from(db.settlements.values());

    return Array.from(db.agents.values()).map((agent) => {
      const providedCompleted = settlements.filter(
        (settlement) =>
          settlement.providerId === agent.id &&
          TERMINAL_SETTLEMENTS.has(settlement.escrowStatus)
      );
      const successfulProvided = providedCompleted.filter(
        (settlement) =>
          settlement.escrowStatus === "released" &&
          settlement.verificationResult === "passed"
      );
      const activeEscrows = settlements.filter(
        (settlement) =>
          (settlement.providerId === agent.id || settlement.requesterId === agent.id) &&
          !TERMINAL_SETTLEMENTS.has(settlement.escrowStatus)
      ).length;
      const totalEarnings = successfulProvided.reduce(
        (sum, settlement) => sum + settlement.amount,
        0
      );
      const totalSpending = settlements
        .filter(
          (settlement) =>
            settlement.requesterId === agent.id &&
            settlement.escrowStatus === "released" &&
            settlement.verificationResult === "passed"
        )
        .reduce((sum, settlement) => sum + settlement.amount, 0);
      const successRate = successRateFor(providedCompleted);

      return {
        ...agent,
        completedSettlements: successfulProvided.length,
        totalEarnings,
        totalSpending,
        activeEscrows,
        successRate,
        reputationScore: reputationFromActivity(successRate, providedCompleted.length),
      };
    });
  }

  static getAgentMap(): Record<string, Agent> {
    return Object.fromEntries(
      this.getAgents().map((agent) => [agent.id, agent])
    );
  }

  static getTaskMap(): Record<string, Task> {
    return Object.fromEntries(
      Array.from(db.tasks.values()).map((task) => [task.id, task])
    );
  }

  static getDashboardStats(): DashboardStats {
    const settlements = Array.from(db.settlements.values());
    const released = releasedSettlements();
    const completed = completedSettlements();
    const receipts = Array.from(db.receipts.values());
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const settlementTimes = released
      .map((settlement) => settlement.settlementTime)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    return {
      totalSettled: released.reduce((sum, settlement) => sum + settlement.amount, 0),
      pendingEscrow: settlements
        .filter((settlement) => !TERMINAL_SETTLEMENTS.has(settlement.escrowStatus))
        .reduce((sum, settlement) => sum + settlement.amount, 0),
      settlementCount: released.length,
      activeAgents: db.agents.size,
      successRate: successRateFor(completed),
      avgSettlementTime:
        settlementTimes.length > 0
          ? average(settlementTimes)
          : average(receipts.map((receipt) => receipt.settlementTime)),
      totalTransactions: settlements.length + receipts.length,
      volume24h: released
        .filter((settlement) => {
          const timestamp = settlement.settledAt ?? settlement.createdAt;
          return new Date(timestamp).getTime() >= oneDayAgo;
        })
        .reduce((sum, settlement) => sum + settlement.amount, 0),
    };
  }

  static getActivities(limit = 15) {
    return db.activities
      .slice()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  static getDataSourceSummary() {
    return {
      primarySource: "persistent-database" as const,
      hasSampleRecords: false,
      sampleRecordCount: 0,
    };
  }

  static getReceipts(): Receipt[] {
    return Array.from(db.receipts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  static getSettlements(): Settlement[] {
    return Array.from(db.settlements.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
}
