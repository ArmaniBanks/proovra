import { db } from "@/lib/db";
import type { Agent, DashboardStats, Receipt, Settlement, Task } from "@/lib/mock-data";

const TERMINAL_SETTLEMENTS = new Set<Settlement["escrowStatus"]>([
  "released",
  "refunded",
  "failed",
]);
const STALE_INCOMPLETE_SETTLEMENT_MS = 6 * 60 * 60 * 1000;

function isSuccessfulReleasedSettlement(settlement: Settlement): boolean {
  return Boolean(
    settlement.escrowStatus === "released" &&
      settlement.verificationResult === "passed" &&
      settlement.releaseTxHash
  );
}

function isStaleIncompleteSettlement(settlement: Settlement): boolean {
  if (isSuccessfulReleasedSettlement(settlement)) return false;
  if (!["submitted", "verified", "failed", "refunded"].includes(settlement.escrowStatus)) {
    return false;
  }
  if (settlement.releaseTxHash || settlement.receiptId) return false;

  const lastUpdated = settlement.verifiedAt ?? settlement.proofSubmittedAt ?? settlement.createdAt;
  return Date.now() - new Date(lastUpdated).getTime() > STALE_INCOMPLETE_SETTLEMENT_MS;
}

function isVisibleSettlement(settlement: Settlement): boolean {
  return isSuccessfulReleasedSettlement(settlement) || !isStaleIncompleteSettlement(settlement);
}

function releasedSettlements() {
  return Array.from(db.settlements.values()).filter((settlement) =>
    isSuccessfulReleasedSettlement(settlement)
  );
}

function completedSettlements() {
  return releasedSettlements();
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
  private static isVisibleAgent(agent: Agent): boolean {
    const hasStandaloneActivity =
      agent.completedSettlements > 0 ||
      agent.totalEarnings > 0 ||
      agent.successRate > 0 ||
      agent.reputationScore > 0 ||
      agent.activeEscrows > 0;

    if (agent.type === "requester") {
      return hasStandaloneActivity;
    }

    return true;
  }

  static getAgents(): Agent[] {
    const settlements = Array.from(db.settlements.values()).filter((settlement) =>
      isVisibleSettlement(settlement)
    );
    const successfulReleased = settlements.filter((settlement) =>
      isSuccessfulReleasedSettlement(settlement)
    );

    return Array.from(db.agents.values()).map((agent) => {
      const successfulProvided = successfulReleased.filter(
        (settlement) => settlement.providerId === agent.id
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
            isSuccessfulReleasedSettlement(settlement)
        )
        .reduce((sum, settlement) => sum + settlement.amount, 0);
      const successRate = successRateFor(successfulProvided);

      return {
        ...agent,
        completedSettlements: successfulProvided.length,
        totalEarnings,
        totalSpending,
        activeEscrows,
        successRate,
        reputationScore: reputationFromActivity(successRate, successfulProvided.length),
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
    const settlements = Array.from(db.settlements.values()).filter((settlement) =>
      isVisibleSettlement(settlement)
    );
    const released = releasedSettlements();
    const completed = completedSettlements();
    const receipts = this.getReceipts();
    const visibleAgents = this.getAgents().filter((agent) => this.isVisibleAgent(agent));
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
      activeAgents: visibleAgents.length,
      successRate: successRateFor(completed),
      avgSettlementTime:
        settlementTimes.length > 0
          ? average(settlementTimes)
          : average(receipts.map((receipt) => receipt.settlementTime)),
      totalTransactions: released.length + receipts.length,
      volume24h: released
        .filter((settlement) => {
          const timestamp = settlement.settledAt ?? settlement.createdAt;
          return new Date(timestamp).getTime() >= oneDayAgo;
        })
        .reduce((sum, settlement) => sum + settlement.amount, 0),
    };
  }

  static getActivities(limit = 15) {
    const hiddenSettlementIds = new Set(
      Array.from(db.settlements.values())
        .filter((settlement) => !isVisibleSettlement(settlement))
        .map((settlement) => settlement.id)
    );
    const hiddenTaskIds = new Set(
      Array.from(db.settlements.values())
        .filter((settlement) => hiddenSettlementIds.has(settlement.id))
        .map((settlement) => settlement.taskId)
    );

    return db.activities
      .slice()
      .filter(
        (activity) =>
          !Array.from(hiddenSettlementIds).some((id) => activity.description.includes(id)) &&
          !Array.from(hiddenTaskIds).some((id) => activity.description.includes(id))
      )
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
    const successfulSettlementIds = new Set(
      releasedSettlements().map((settlement) => settlement.id)
    );

    return Array.from(db.receipts.values()).filter(
      (receipt) => successfulSettlementIds.has(receipt.settlementId)
    ).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  static getSettlements(): Settlement[] {
    return Array.from(db.settlements.values()).filter(
        (settlement) => isVisibleSettlement(settlement)
    ).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
}
