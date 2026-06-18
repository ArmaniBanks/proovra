import { createHash } from "node:crypto";
import type {
  EscrowCreateInput,
  EscrowCreateResult,
  SettlementProvider,
  SettlementReleaseInput,
  SettlementReleaseResult,
} from "./types";
import { getCastCommand, runCli } from "./cli";

type JsonRpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
};

type ArcLog = {
  address: string;
  topics: string[];
  data: string;
};

type ArcTransactionReceipt = {
  transactionHash: string;
  blockNumber: string;
  status?: string;
  from: string;
  to: string | null;
  contractAddress?: string | null;
  gasUsed?: string;
  logs?: ArcLog[];
};

type ArcTestnetConfig = {
  rpcUrl: string;
  contractAddress: string;
  fromAddress?: string;
  requesterAddress?: string;
  providerAddress?: string;
  tokenAddress?: string;
  privateKey?: string;
  autoApprove: boolean;
  createRawTransaction?: string;
  releaseRawTransaction?: string;
  value: string;
  confirmationTarget: number;
  pollAttempts: number;
  pollIntervalMs: number;
  expirySeconds: number;
  amountUnits?: bigint;
};

const CREATE_ESCROW_SELECTOR = "3be62ad8";
const RELEASE_AFTER_PROOF_SELECTOR = "df4391ed";
const ESCROW_CREATED_TOPIC =
  "0xea2f03c06a883d584df027f8d0afdc1e2c1804c0a1f21a6dd3c72e2b5d40c140";

function requireArcConfig(): ArcTestnetConfig {
  const rpcUrl = process.env.ARC_TESTNET_RPC_URL;
  if (!rpcUrl) {
    throw new Error("ARC_TESTNET_RPC_URL is required when PROOVRA_SETTLEMENT_PROVIDER=arc-testnet.");
  }

  const contractAddress = process.env.ARC_TESTNET_SETTLEMENT_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("ARC_TESTNET_SETTLEMENT_CONTRACT_ADDRESS is required for Arc contract settlement.");
  }

  return {
    rpcUrl,
    contractAddress,
    fromAddress: process.env.ARC_TESTNET_FROM_ADDRESS,
    requesterAddress: process.env.ARC_TESTNET_REQUESTER_ADDRESS,
    providerAddress: process.env.ARC_TESTNET_PROVIDER_ADDRESS,
    tokenAddress:
      process.env.ARC_TESTNET_USDC_ADDRESS ||
      process.env.ARC_TESTNET_TEST_TOKEN_ADDRESS,
    privateKey:
      process.env.ARC_TESTNET_DEPLOYER_PRIVATE_KEY ||
      process.env.ARC_TESTNET_PRIVATE_KEY,
    autoApprove: process.env.ARC_TESTNET_AUTO_APPROVE === "true",
    createRawTransaction: process.env.ARC_TESTNET_CREATE_ESCROW_RAW_TX,
    releaseRawTransaction:
      process.env.ARC_TESTNET_RELEASE_ESCROW_RAW_TX ||
      process.env.ARC_TESTNET_SETTLEMENT_RAW_TX,
    value: process.env.ARC_TESTNET_SETTLEMENT_VALUE_WEI || "0x0",
    confirmationTarget: Number(process.env.ARC_TESTNET_CONFIRMATION_TARGET || 1),
    pollAttempts: Number(process.env.ARC_TESTNET_RECEIPT_POLL_ATTEMPTS || 20),
    pollIntervalMs: Number(process.env.ARC_TESTNET_RECEIPT_POLL_INTERVAL_MS || 3000),
    expirySeconds: Number(process.env.ARC_TESTNET_ESCROW_EXPIRY_SECONDS || 86400),
    amountUnits: process.env.ARC_TESTNET_SETTLEMENT_AMOUNT_UNITS
      ? BigInt(process.env.ARC_TESTNET_SETTLEMENT_AMOUNT_UNITS)
      : undefined,
  };
}

function assertAddress(address: string | undefined, label: string) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`${label} must be a 20-byte hex address.`);
  }

  return address;
}

function normalizeBytes32(value: string | undefined, label: string) {
  if (!value || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a 32-byte hex value.`);
  }

  return value;
}

function encodeUint(value: bigint | number) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function encodeAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function encodeBytes32(value: string) {
  return value.replace(/^0x/, "").padStart(64, "0");
}

function encodeCreateEscrowCalldata(
  provider: string,
  token: string,
  amount: bigint,
  proofHash: string,
  expiresAt: number
) {
  return `0x${CREATE_ESCROW_SELECTOR}${encodeAddress(provider)}${encodeAddress(
    token
  )}${encodeUint(amount)}${encodeBytes32(proofHash)}${encodeUint(expiresAt)}`;
}

function encodeReleaseCalldata(escrowId: bigint, proofHash: string) {
  return `0x${RELEASE_AFTER_PROOF_SELECTOR}${encodeUint(escrowId)}${encodeBytes32(
    proofHash
  )}`;
}

function extractTransactionHash(output: string) {
  try {
    const parsed = JSON.parse(output) as { transactionHash?: string; hash?: string };
    const hash = parsed.transactionHash || parsed.hash;
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) return hash;
  } catch {
    // Fall through to regex extraction for non-JSON cast output.
  }

  const match = output.match(/0x[a-fA-F0-9]{64}/);
  if (!match) {
    throw new Error("Could not parse transaction hash from cast output.");
  }
  return match[0];
}

function amountToTokenUnits(amount: number, configuredAmount?: bigint) {
  if (configuredAmount !== undefined) return configuredAmount;
  return BigInt(Math.max(1, Math.round(amount * 1_000_000)));
}

function createFallbackEscrowId(input: EscrowCreateInput) {
  const hash = createHash("sha256")
    .update(`arc-testnet-escrow:${input.settlementId}:${input.taskId}:${input.requesterId}:${input.providerId}`)
    .digest("hex");

  return `0x${hash.slice(0, 40)}`;
}

function hexToNumber(hex: string | undefined) {
  if (!hex) return 0;
  return Number.parseInt(hex, 16);
}

function parseEscrowId(receipt: ArcTransactionReceipt | null) {
  const log = receipt?.logs?.find(
    (entry) => entry.topics[0]?.toLowerCase() === ESCROW_CREATED_TOPIC
  );
  const topic = log?.topics[1];
  if (!topic) return undefined;
  return BigInt(topic).toString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ArcJsonRpcClient {
  private nextId = 1;

  constructor(private readonly rpcUrl: string) {}

  async request<T>(method: string, params: unknown[] = []): Promise<T> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
    });

    if (!response.ok) {
      throw new Error(`Arc RPC ${method} failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if (payload.error) {
      throw new Error(`Arc RPC ${method} failed: ${payload.error.message}`);
    }
    if (payload.result === undefined) {
      throw new Error(`Arc RPC ${method} returned no result`);
    }

    return payload.result;
  }

  async submitRawTransaction(rawTransaction: string) {
    return this.request<string>("eth_sendRawTransaction", [rawTransaction]);
  }

  async submitManagedTransaction(from: string, to: string, value: string, data: string) {
    return this.request<string>("eth_sendTransaction", [{ from, to, value, data }]);
  }

  async getTransactionReceipt(txHash: string) {
    return this.request<ArcTransactionReceipt | null>("eth_getTransactionReceipt", [txHash]);
  }

  async getBlockNumber() {
    return this.request<string>("eth_blockNumber");
  }
}

async function submitSignedContractCall(
  config: ArcTestnetConfig,
  to: string,
  signature: string,
  args: string[]
) {
  if (!config.privateKey) {
    throw new Error("ARC_TESTNET_DEPLOYER_PRIVATE_KEY is required for local signed Arc transactions.");
  }

  const result = await runCli(
    getCastCommand(),
    [
      "send",
      to,
      signature,
      ...args,
      "--rpc-url",
      config.rpcUrl,
      "--private-key",
      config.privateKey,
      "--json",
    ],
    120_000
  );

  return extractTransactionHash(result.stdout || result.stderr);
}

async function submitApprovalIfConfigured(
  config: ArcTestnetConfig,
  token: string,
  spender: string,
  amount: bigint
) {
  if (!config.autoApprove || !config.privateKey) return undefined;

  return submitSignedContractCall(config, token, "approve(address,uint256)", [
    spender,
    amount.toString(),
  ]);
}

async function waitForReceipt(
  client: ArcJsonRpcClient,
  txHash: string,
  config: ArcTestnetConfig
) {
  for (let attempt = 0; attempt < config.pollAttempts; attempt++) {
    const receipt = await client.getTransactionReceipt(txHash);
    if (receipt) return receipt;
    await sleep(config.pollIntervalMs);
  }

  return null;
}

async function confirmationMetadata(
  client: ArcJsonRpcClient,
  receipt: ArcTransactionReceipt | null,
  config: ArcTestnetConfig
) {
  const latestBlock = hexToNumber(await client.getBlockNumber());
  const receiptBlock = hexToNumber(receipt?.blockNumber);
  const confirmations =
    receiptBlock > 0 ? Math.max(0, latestBlock - receiptBlock + 1) : 0;
  const failed = receipt?.status === "0x0";
  const confirmed = !!receipt && !failed && confirmations >= config.confirmationTarget;

  return {
    blockNumber: receiptBlock,
    confirmations,
    status: failed ? "failed" : confirmed ? "confirmed" : "pending",
    confirmationStatus: failed ? "failed" : confirmed ? "confirmed" : "confirming",
  } as const;
}

class ArcTestnetSettlementProvider implements SettlementProvider {
  async createEscrow(input: EscrowCreateInput): Promise<EscrowCreateResult> {
    const config = requireArcConfig();
    const client = new ArcJsonRpcClient(config.rpcUrl);
    const start = Date.now();
    const proofHash = normalizeBytes32(input.proofHash, "Arc escrow proofHash");
    const provider = assertAddress(
      config.providerAddress,
      "ARC_TESTNET_PROVIDER_ADDRESS"
    );
    const token = assertAddress(config.tokenAddress, "ARC_TESTNET_USDC_ADDRESS");
    const from = assertAddress(
      config.requesterAddress || config.fromAddress,
      "ARC_TESTNET_REQUESTER_ADDRESS or ARC_TESTNET_FROM_ADDRESS"
    );

    const amount = amountToTokenUnits(input.amount, config.amountUnits);
    const expiresAt = Math.floor(Date.now() / 1000) + config.expirySeconds;
    const calldata = encodeCreateEscrowCalldata(provider, token, amount, proofHash, expiresAt);
    await submitApprovalIfConfigured(config, token, config.contractAddress, amount);
    const txHash = config.createRawTransaction
      ? await client.submitRawTransaction(config.createRawTransaction)
      : config.privateKey
        ? await submitSignedContractCall(
            config,
            config.contractAddress,
            "createEscrow(address,address,uint256,bytes32,uint64)",
            [provider, token, amount.toString(), proofHash, String(expiresAt)]
          )
      : await client.submitManagedTransaction(
          from,
          config.contractAddress,
          config.value,
          calldata
        );
    const receipt = await waitForReceipt(client, txHash, config);
    const metadata = await confirmationMetadata(client, receipt, config);
    const externalEscrowId = parseEscrowId(receipt) ?? createFallbackEscrowId(input);

    return {
      externalEscrowId,
      requesterId: input.requesterId,
      providerId: input.providerId,
      amount: input.amount,
      status: "locked",
      provider: "arc-testnet",
      txHash,
      blockNumber: metadata.blockNumber,
      confirmationStatus: metadata.confirmationStatus,
      confirmations: metadata.confirmations,
      contractAddress: config.contractAddress,
      settlementTime: Date.now() - start,
    };
  }

  async releaseFunds(input: SettlementReleaseInput): Promise<SettlementReleaseResult> {
    const config = requireArcConfig();
    const client = new ArcJsonRpcClient(config.rpcUrl);
    const start = Date.now();
    const proofHash = normalizeBytes32(input.proofHash, "Arc release proofHash");
    const from = assertAddress(
      config.requesterAddress || config.fromAddress,
      "ARC_TESTNET_REQUESTER_ADDRESS or ARC_TESTNET_FROM_ADDRESS"
    );
    const escrowId = BigInt(input.externalEscrowId || "0");
    if (escrowId <= BigInt(0)) {
      throw new Error("Arc release requires a numeric externalEscrowId from createEscrow.");
    }

    const calldata = encodeReleaseCalldata(escrowId, proofHash);
    const txHash = config.releaseRawTransaction
      ? await client.submitRawTransaction(config.releaseRawTransaction)
      : config.privateKey
        ? await submitSignedContractCall(
            config,
            config.contractAddress,
            "releaseAfterProof(uint256,bytes32)",
            [escrowId.toString(), proofHash]
          )
      : await client.submitManagedTransaction(
          from,
          config.contractAddress,
          config.value,
          calldata
        );
    const receipt = await waitForReceipt(client, txHash, config);
    const metadata = await confirmationMetadata(client, receipt, config);

    return {
      txHash,
      blockNumber: metadata.blockNumber,
      from: receipt?.from ?? from,
      to: receipt?.to ?? config.contractAddress,
      amount: input.amount,
      currency: "USDC",
      status: metadata.status,
      timestamp: new Date(),
      settlementTime: Date.now() - start,
      provider: "arc-testnet",
      confirmationStatus: metadata.confirmationStatus,
      confirmations: metadata.confirmations,
      externalSettlementId: input.settlementId,
      contractAddress: config.contractAddress,
    };
  }
}

export function createArcTestnetSettlementProvider(): SettlementProvider {
  return new ArcTestnetSettlementProvider();
}
