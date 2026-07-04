"use client";

import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { arcTestnetChain, hasPrivyConfig, privyAppId } from "@/lib/privy-config";

const privyConfig: PrivyClientConfig = {
  loginMethods: ["email"],
  appearance: {
    theme: "dark",
    accentColor: "#f59e0b",
    logo: "/icon.png",
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
  supportedChains: [arcTestnetChain],
  defaultChain: arcTestnetChain,
};

export function Providers({ children }: { children: React.ReactNode }) {
  if (!hasPrivyConfig) return <>{children}</>;

  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
