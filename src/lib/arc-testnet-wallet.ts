export const ARC_TESTNET = {
  chainId: "0x4cef52",
  chainIdDecimal: 5042002,
  chainName: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorerUrl: "https://testnet.arcscan.app",
  nativeCurrency: {
    name: "Arc Testnet ETH",
    symbol: "ETH",
    decimals: 18,
  },
  settlementContract: "0x38D7C4cC9C108D127923651ced41bdb123Dbc611",
  usdcToken: "0x3600000000000000000000000000000000000000",
} as const;

export type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
};

type TransactionReceipt = {
  transactionHash: string;
  blockNumber: string;
  status: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
};

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    message?: string;
  };
};

export const ESCROW_CREATED_TOPIC =
  "0xea2f03c06a883d584df027f8d0afdc1e2c1804c0a1f21a6dd3c72e2b5d40c140";

function assertHexAddress(value: string, label: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }
}

function padHex(value: string) {
  return value.replace(/^0x/, "").padStart(64, "0");
}

function encodeAddress(value: string) {
  assertHexAddress(value, "Address");
  return padHex(value.toLowerCase());
}

function encodeUint(value: bigint | number) {
  const bigintValue = typeof value === "bigint" ? value : BigInt(value);
  if (bigintValue < BigInt(0)) throw new Error("Uint value cannot be negative.");
  return bigintValue.toString(16).padStart(64, "0");
}

function encodeBytes32(value: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("Proof hash must be a 32-byte hex value.");
  }
  return value.replace(/^0x/, "").toLowerCase();
}

export function toUsdcBaseUnits(amount: number) {
  const baseUnits = Math.round(amount * 1_000_000);
  if (!Number.isFinite(baseUnits) || baseUnits <= 0) {
    throw new Error("Settlement amount must be greater than zero.");
  }
  return BigInt(baseUnits);
}

export async function hashProofMaterial(material: string) {
  const text = material.trim();
  if (!text) throw new Error("Proof content is required.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `0x${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function ensureArcTestnet(provider: EthereumProvider) {
  const chainId = await provider.request<string>({ method: "eth_chainId" });
  if (chainId?.toLowerCase() === ARC_TESTNET.chainId) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET.chainId }],
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
    if (code !== 4902) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: ARC_TESTNET.chainId,
          chainName: ARC_TESTNET.chainName,
          nativeCurrency: ARC_TESTNET.nativeCurrency,
          rpcUrls: [ARC_TESTNET.rpcUrl],
          blockExplorerUrls: [ARC_TESTNET.explorerUrl],
        },
      ],
    });
  }
}

export function encodeApprove(spender: string, amount: bigint) {
  return `0x095ea7b3${encodeAddress(spender)}${encodeUint(amount)}`;
}

export function encodeCreateEscrow(input: {
  provider: string;
  token: string;
  amount: bigint;
  proofHash: string;
  expiresAt: number;
}) {
  return `0x3be62ad8${encodeAddress(input.provider)}${encodeAddress(input.token)}${encodeUint(
    input.amount
  )}${encodeBytes32(input.proofHash)}${encodeUint(input.expiresAt)}`;
}

export function encodeReleaseAfterProof(escrowId: string, proofHash: string) {
  return `0xdf4391ed${encodeUint(BigInt(escrowId))}${encodeBytes32(proofHash)}`;
}

export async function sendWalletTransaction(
  provider: EthereumProvider,
  from: string,
  to: string,
  data: string
) {
  assertHexAddress(from, "Wallet address");
  assertHexAddress(to, "Transaction target");
  return provider.request<string>({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to,
        data,
        value: "0x0",
      },
    ],
  });
}

export async function waitForArcReceipt(txHash: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = await fetch(ARC_TESTNET.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    });
    const payload = (await response.json()) as JsonRpcResponse<TransactionReceipt | null>;
    if (payload.error?.message) throw new Error(payload.error.message);
    if (payload.result) {
      if (payload.result.status !== "0x1") {
        throw new Error(
          `Arc transaction reverted on Arc Testnet: ${txHash}. Confirm the connected wallet is the requester, the escrow is still open, and the proof hash matches the escrow commitment. ArcScan: ${arcTxLink(txHash)}`
        );
      }
      return {
        ...payload.result,
        blockNumber: Number.parseInt(payload.result.blockNumber, 16),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out waiting for Arc transaction receipt: ${txHash}`);
}

export function extractEscrowId(receipt: Awaited<ReturnType<typeof waitForArcReceipt>>) {
  const event = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === ARC_TESTNET.settlementContract.toLowerCase() &&
      log.topics[0]?.toLowerCase() === ESCROW_CREATED_TOPIC
  );
  if (!event?.topics[1]) {
    throw new Error("EscrowCreated event was not found in the Arc transaction receipt.");
  }
  return BigInt(event.topics[1]).toString();
}

export function arcTxLink(txHash: string) {
  return `${ARC_TESTNET.explorerUrl}/tx/${txHash}`;
}
