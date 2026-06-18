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
