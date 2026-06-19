import { db } from "@/lib/db";
import type { Agent, AgentRole, AgentType } from "@/lib/mock-data";
import { generateShortId } from "@/lib/utils";
import { isValidWalletAddress } from "@/lib/wallet-validation";
import { ReadModelService } from "./read-model.service";

type AgentRegistrationInput = {
  name: string;
  role: AgentRole;
  type: AgentType;
  description: string;
  walletAddress: string;
  avatar?: string;
};

export class AgentService {
  private static hasMeaningfulActivity(agent: Agent): boolean {
    return (
      agent.completedSettlements > 0 ||
      agent.totalEarnings > 0 ||
      agent.totalSpending > 0 ||
      agent.successRate > 0 ||
      agent.reputationScore > 0 ||
      agent.activeEscrows > 0
    );
  }

  private static getLinkedAgentIds(): Set<string> {
    const linkedAgentIds = new Set<string>();

    for (const task of db.tasks.values()) {
      linkedAgentIds.add(task.requesterId);
      if (task.providerId) linkedAgentIds.add(task.providerId);
    }

    for (const settlement of db.settlements.values()) {
      linkedAgentIds.add(settlement.requesterId);
      linkedAgentIds.add(settlement.providerId);
    }

    for (const receipt of db.receipts.values()) {
      linkedAgentIds.add(receipt.requesterId);
      linkedAgentIds.add(receipt.providerId);
    }

    for (const wallet of db.wallets.values()) {
      linkedAgentIds.add(wallet.agentId);
    }

    return linkedAgentIds;
  }

  private static getDuplicateKey(agent: Agent): string {
    return [
      agent.walletAddress.toLowerCase(),
      agent.type,
      agent.role,
      agent.name.trim().toLowerCase(),
    ].join("|");
  }

  static pruneUnusedDuplicateAgents(): number {
    const agents = ReadModelService.getAgents();
    const linkedAgentIds = this.getLinkedAgentIds();
    const groups = new Map<string, Agent[]>();

    for (const agent of agents) {
      const group = groups.get(this.getDuplicateKey(agent)) ?? [];
      group.push(agent);
      groups.set(this.getDuplicateKey(agent), group);
    }

    let removedCount = 0;

    for (const group of groups.values()) {
      if (group.length < 2) continue;

      const sorted = group.sort(
        (a, b) =>
          new Date(b.registeredAt).getTime() -
          new Date(a.registeredAt).getTime()
      );
      const firstUsableAgent = sorted.find(
        (agent) => linkedAgentIds.has(agent.id) || this.hasMeaningfulActivity(agent)
      );
      const protectedAgentId = firstUsableAgent?.id ?? sorted[0].id;

      for (const agent of sorted) {
        const isProtected = agent.id === protectedAgentId;
        const isLinked = linkedAgentIds.has(agent.id);
        const hasActivity = this.hasMeaningfulActivity(agent);

        if (!isProtected && !isLinked && !hasActivity) {
          db.activities = db.activities.filter((activity) => activity.agentId !== agent.id);
          if (db.agents.delete(agent.id)) {
            removedCount += 1;
          }
        }
      }
    }

    return removedCount;
  }

  static getAllAgents(): Agent[] {
    return ReadModelService.getAgents();
  }

  static getAgent(id: string): Agent | undefined {
    return ReadModelService.getAgentMap()[id];
  }

  static registerAgent(input: AgentRegistrationInput): Agent {
    if (!isValidWalletAddress(input.walletAddress)) {
      throw new Error("A valid EVM wallet address is required.");
    }

    const agent: Agent = {
      id: generateShortId().replace("PV-", "agent-").toLowerCase(),
      name: input.name,
      role: input.role,
      type: input.type,
      description: input.description,
      walletAddress: input.walletAddress,
      avatar: input.avatar ?? "AI",
      completedSettlements: 0,
      totalEarnings: 0,
      totalSpending: 0,
      successRate: 0,
      reputationScore: 0,
      activeEscrows: 0,
      registeredAt: new Date(),
    };

    db.agents.set(agent.id, agent);
    db.addActivity({
      type: "agent_registered",
      agentId: agent.id,
      description: `${agent.name} registered`,
    });

    return agent;
  }

  static updateReputation(agentId: string, success: boolean) {
    const agent = db.agents.get(agentId);
    if (!agent) return;

    if (success) {
      agent.completedSettlements += 1;
      // Slight bump in reputation for success
      agent.reputationScore = Math.min(100, agent.reputationScore + (100 - agent.reputationScore) * 0.05);
    } else {
      // Larger drop for failure
      agent.reputationScore = Math.max(0, agent.reputationScore - 5);
    }
    
    // Recalculate success rate roughly
    agent.successRate = success ? Math.min(100, agent.successRate + 0.1) : Math.max(0, agent.successRate - 2.0);

    db.agents.set(agentId, agent);

    db.addActivity({
      type: "reputation_updated",
      agentId,
      description: `Reputation updated to ${Math.round(agent.reputationScore)}`,
    });
  }
}
