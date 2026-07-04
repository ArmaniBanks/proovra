export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const hasPrivyConfig = privyAppId.trim().length > 0;

export const arcTestnetChain = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Arc Testnet ETH",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
} as const;
