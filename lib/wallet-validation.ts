export function normalizeWalletAddress(address: string | undefined | null): string {
  return String(address ?? "").trim().toLowerCase();
}

export function isValidWalletAddress(address: string | undefined | null): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address ?? "").trim());
}

export function areSameWallet(
  firstAddress: string | undefined | null,
  secondAddress: string | undefined | null
): boolean {
  const first = normalizeWalletAddress(firstAddress);
  const second = normalizeWalletAddress(secondAddress);
  return Boolean(first && second && first === second);
}

export function assertDifferentWallets(
  requesterWallet: string | undefined | null,
  providerWallet: string | undefined | null
) {
  if (!isValidWalletAddress(requesterWallet)) {
    throw new Error("Requester wallet address is required.");
  }
  if (!isValidWalletAddress(providerWallet)) {
    throw new Error("Provider wallet address is required.");
  }
  if (areSameWallet(requesterWallet, providerWallet)) {
    throw new Error("Requester wallet and provider wallet must be different.");
  }
}
