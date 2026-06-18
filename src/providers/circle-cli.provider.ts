import type {
  AgentWallet,
  AgentWalletCreateInput,
  WalletProvider,
  WalletTransferInput,
  WalletTransferResult,
} from "./types";
import { getCircleCliCommand, parseJsonOutput, runCli } from "./cli";

type CircleWalletEntry = {
  id?: string;
  walletId?: string;
  address?: string;
  balance?: string | number;
  balances?: Array<{ token?: { symbol?: string }; amount?: string }>;
  status?: string;
};

type CircleWalletListOutput =
  | CircleWalletEntry[]
  | {
      wallets?: CircleWalletEntry[];
      data?: CircleWalletEntry[] | { wallets?: CircleWalletEntry[] };
    };

type CircleTransferOutput = {
  id?: string;
  transactionId?: string;
  hash?: string;
  status?: string;
};

function getCircleChain() {
  return process.env.CIRCLE_CLI_CHAIN || "ARC-TESTNET";
}

function extractWallets(output: CircleWalletListOutput) {
  if (Array.isArray(output)) return output;
  if (Array.isArray(output.data)) return output.data;
  if (output.data?.wallets) return output.data.wallets;
  return output.wallets ?? [];
}

function toAgentWallet(entry: CircleWalletEntry, agentId: string): AgentWallet {
  const id = entry.id || entry.walletId || entry.address;
  if (!id || !entry.address) {
    throw new Error("Circle CLI wallet list did not include wallet id and address.");
  }

  const balanceEntry = entry.balances?.find(
    (balance) => balance.token?.symbol === "USDC"
  );
  const balance = Number(entry.balance ?? balanceEntry?.amount ?? 0);

  return {
    id,
    externalId: id,
    agentId,
    address: entry.address,
    balance: Number.isFinite(balance) ? balance : 0,
    currency: "USDC",
    chain: "arc",
    provider: "circle-cli",
    status: entry.status === "disabled" ? "disabled" : "active",
  };
}

async function listCircleWallets(agentId: string) {
  const result = await runCli(getCircleCliCommand(), [
    "wallet",
    "list",
    "--chain",
    getCircleChain(),
    "--type",
    "agent",
    "--output",
    "json",
  ]);
  const parsed = parseJsonOutput<CircleWalletListOutput>(
    result.stdout,
    "Circle CLI wallet list"
  );
  return extractWallets(parsed).map((wallet) => toAgentWallet(wallet, agentId));
}

class CircleCliWalletProvider implements WalletProvider {
  async createAgentWallet(input: AgentWalletCreateInput): Promise<AgentWallet> {
    const existing = await listCircleWallets(input.agentId);
    if (existing.length > 0) return existing[0];

    await runCli(getCircleCliCommand(), ["wallet", "create"], 60_000);
    const created = await listCircleWallets(input.agentId);
    if (created.length === 0) {
      throw new Error("Circle CLI wallet create completed but no agent wallet was listed.");
    }

    return created[0];
  }

  async transferUSDC(input: WalletTransferInput): Promise<WalletTransferResult> {
    const result = await runCli(getCircleCliCommand(), [
      "wallet",
      "transfer",
      input.to,
      "--amount",
      String(input.amount),
      "--address",
      input.from,
      "--chain",
      getCircleChain(),
      "--output",
      "json",
    ]);
    const parsed = parseJsonOutput<CircleTransferOutput>(
      result.stdout,
      "Circle CLI wallet transfer"
    );

    return {
      id: parsed.id || parsed.transactionId || parsed.hash || `circle-cli-${Date.now()}`,
      from: input.from,
      to: input.to,
      amount: input.amount,
      currency: "USDC",
      status: parsed.status === "failed" ? "failed" : "pending",
      timestamp: new Date(),
    };
  }
}

export function createCircleCliWalletProvider(): WalletProvider {
  return new CircleCliWalletProvider();
}
