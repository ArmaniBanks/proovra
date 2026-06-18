import { db } from "@/lib/db";
import type { Task, TaskStatus } from "@/lib/mock-data";
import { generateShortId } from "@/lib/utils";
import { areSameWallet, assertDifferentWallets, isValidWalletAddress } from "@/lib/wallet-validation";
import { AgentService } from "./agent.service";

export class TaskService {
  static getAllTasks(): Task[] {
    return Array.from(db.tasks.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static getTask(id: string): Task | undefined {
    return db.tasks.get(id);
  }

  static createTask(data: Omit<Task, "id" | "status" | "createdAt">): Task {
    const requester = db.agents.get(data.requesterId);

    if (!requester) {
      throw new Error("Requester agent not found");
    }
    if (data.providerId) {
      const provider = db.agents.get(data.providerId);
      if (!provider) {
        throw new Error("Provider agent not found");
      }
      if (data.requesterId === data.providerId) {
        throw new Error("Requester and provider must be different agents");
      }
      assertDifferentWallets(requester.walletAddress, provider.walletAddress);
    }

    const task: Task = {
      ...data,
      id: generateShortId().replace("PV-", "task-"),
      status: "created",
      createdAt: new Date(),
    };
    db.tasks.set(task.id, task);
    db.addActivity({
      type: "escrow_created",
      agentId: task.requesterId,
      description: data.providerId
        ? `Task ${task.id} created for ${data.providerId}`
        : `Task ${task.id} opened for provider acceptance`,
      amount: task.amount,
    });
    return task;
  }

  static acceptTask(taskId: string, walletAddress: string): Task {
    const task = db.tasks.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.providerId) throw new Error("Task already has a provider.");
    if (task.status !== "created") throw new Error("Only open tasks can be accepted.");
    if (!isValidWalletAddress(walletAddress)) throw new Error("A valid provider wallet is required.");

    const requester = db.agents.get(task.requesterId);
    if (!requester) throw new Error("Requester agent not found");
    assertDifferentWallets(requester.walletAddress, walletAddress);

    const existingProvider = Array.from(db.agents.values()).find(
      (agent) =>
        (agent.type === "provider" || agent.type === "both") &&
        areSameWallet(agent.walletAddress, walletAddress)
    );
    const provider =
      existingProvider ??
      AgentService.registerAgent({
        name: "Provider Agent",
        role: "research",
        type: "provider",
        description: "Provider participant attached automatically when accepting an open task.",
        walletAddress,
        avatar: "PB",
      });

    task.providerId = provider.id;
    task.status = "in-progress";
    db.tasks.set(taskId, task);
    db.addActivity({
      type: "work_submitted",
      agentId: provider.id,
      description: `Provider ${provider.id} accepted task ${task.id}`,
      amount: task.amount,
    });
    return task;
  }

  static updateTaskStatus(taskId: string, status: TaskStatus) {
    const task = db.tasks.get(taskId);
    if (!task) throw new Error("Task not found");
    
    task.status = status;
    db.tasks.set(taskId, task);
    db.addActivity({
      type:
        status === "verified"
          ? "verification_passed"
          : status === "failed"
          ? "verification_failed"
          : status === "delivered"
          ? "work_submitted"
          : "escrow_created",
      agentId: status === "delivered" ? task.providerId ?? task.requesterId : task.requesterId,
      description: `Task ${task.id} moved to ${status}`,
      amount: task.amount,
    });
    return task;
  }
}
