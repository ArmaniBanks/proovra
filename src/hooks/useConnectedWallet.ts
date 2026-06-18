"use client";

import { useEffect, useState } from "react";

export const CONNECTED_WALLET_KEY = "proovra.connectedWallet";
export const WALLET_UPDATED_EVENT = "proovra-wallet-updated";

export function saveConnectedWallet(address: string) {
  window.localStorage.setItem(CONNECTED_WALLET_KEY, address);
  window.dispatchEvent(new Event(WALLET_UPDATED_EVENT));
}

export function clearConnectedWallet() {
  window.localStorage.removeItem(CONNECTED_WALLET_KEY);
  window.dispatchEvent(new Event(WALLET_UPDATED_EVENT));
}

export function useConnectedWallet() {
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    function readWallet() {
      setWalletAddress(window.localStorage.getItem(CONNECTED_WALLET_KEY) ?? "");
    }

    readWallet();
    window.addEventListener("storage", readWallet);
    window.addEventListener(WALLET_UPDATED_EVENT, readWallet);

    return () => {
      window.removeEventListener("storage", readWallet);
      window.removeEventListener(WALLET_UPDATED_EVENT, readWallet);
    };
  }, []);

  return walletAddress;
}
