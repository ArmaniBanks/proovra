import { encodeFunctionData, maxUint256, parseUnits } from "viem";

export const ARC_GATEWAY_CHAIN = {
  id: 5042002,
  name: "Arc Testnet",
  domain: 26,
  usdc: "0x3600000000000000000000000000000000000000",
  gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
  gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
} as const;

export const MIN_GATEWAY_WITHDRAWAL_AMOUNT = "0.05";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const GATEWAY_WITHDRAWAL_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
  ],
  TransferSpec: [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ],
  BurnIntent: [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ],
} as const;

export const GATEWAY_MINTER_ABI = [
  {
    name: "gatewayMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestationPayload", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export type GatewayBurnIntent = {
  maxBlockHeight: string;
  maxFee: string;
  spec: {
    version: 1;
    sourceDomain: number;
    destinationDomain: number;
    sourceContract: `0x${string}`;
    destinationContract: `0x${string}`;
    sourceToken: `0x${string}`;
    destinationToken: `0x${string}`;
    sourceDepositor: `0x${string}`;
    destinationRecipient: `0x${string}`;
    sourceSigner: `0x${string}`;
    destinationCaller: `0x${string}`;
    value: string;
    salt: `0x${string}`;
    hookData: `0x${string}`;
  };
};

export type GatewayWithdrawalTypedData = {
  domain: {
    name: "GatewayWallet";
    version: "1";
  };
  types: typeof GATEWAY_WITHDRAWAL_TYPES;
  primaryType: "BurnIntent";
  message: GatewayBurnIntent;
};

export function isWallet(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isNonZeroWallet(value: unknown): value is `0x${string}` {
  return isWallet(value) && value.toLowerCase() !== ZERO_ADDRESS;
}

export function parseUsdcUnits(amount: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(amount.trim())) {
    throw new Error("Amount must be a valid USDC value with up to 6 decimals.");
  }
  const parsed = parseUnits(amount, 6);
  if (parsed <= BigInt(0)) throw new Error("Amount must be greater than zero.");
  return parsed;
}

export function addressToBytes32(address: `0x${string}`): `0x${string}` {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

export function createArcGatewayBurnIntent(input: {
  amount: string;
  sourceDepositor: `0x${string}`;
  recipient: `0x${string}`;
  salt: `0x${string}`;
  maxFee?: string;
}): GatewayBurnIntent {
  const value = parseUsdcUnits(input.amount);
  const maxFee = parseUsdcUnits(input.maxFee ?? "2.01");

  return {
    maxBlockHeight: maxUint256.toString(),
    maxFee: maxFee.toString(),
    spec: {
      version: 1,
      sourceDomain: ARC_GATEWAY_CHAIN.domain,
      destinationDomain: ARC_GATEWAY_CHAIN.domain,
      sourceContract: addressToBytes32(ARC_GATEWAY_CHAIN.gatewayWallet),
      destinationContract: addressToBytes32(ARC_GATEWAY_CHAIN.gatewayMinter),
      sourceToken: addressToBytes32(ARC_GATEWAY_CHAIN.usdc),
      destinationToken: addressToBytes32(ARC_GATEWAY_CHAIN.usdc),
      sourceDepositor: addressToBytes32(input.sourceDepositor),
      destinationRecipient: addressToBytes32(input.recipient),
      sourceSigner: addressToBytes32(input.sourceDepositor),
      destinationCaller: addressToBytes32("0x0000000000000000000000000000000000000000"),
      value: value.toString(),
      salt: input.salt,
      hookData: "0x",
    },
  };
}

export function createGatewayWithdrawalTypedData(
  burnIntent: GatewayBurnIntent
): GatewayWithdrawalTypedData {
  return {
    domain: {
      name: "GatewayWallet",
      version: "1",
    },
    types: GATEWAY_WITHDRAWAL_TYPES,
    primaryType: "BurnIntent",
    message: burnIntent,
  };
}

export function encodeGatewayMintCall(input: {
  attestation: `0x${string}`;
  signature: `0x${string}`;
}) {
  return encodeFunctionData({
    abi: GATEWAY_MINTER_ABI,
    functionName: "gatewayMint",
    args: [input.attestation, input.signature],
  });
}
