const DEFAULT_PLATFORM_FEE_BPS = 1000;
const MAX_PLATFORM_FEE_BPS = 5000;
const USDC_DECIMALS = 6;

function roundUsdc(value: number) {
  return Number(value.toFixed(USDC_DECIMALS));
}

export function getPlatformFeeBps() {
  const configured = Number(process.env.PROOVRA_PLATFORM_FEE_BPS);
  if (!Number.isFinite(configured)) return DEFAULT_PLATFORM_FEE_BPS;
  return Math.min(
    MAX_PLATFORM_FEE_BPS,
    Math.max(0, Math.round(configured))
  );
}

export function platformFeePercent(feeBps = getPlatformFeeBps()) {
  return feeBps / 100;
}

export function calculateAccessRevenue(
  grossAmount: number,
  feeBps = getPlatformFeeBps()
) {
  const gross = roundUsdc(Math.max(0, grossAmount));
  const platformFee = roundUsdc((gross * feeBps) / 10_000);
  const creatorNetAmount = roundUsdc(Math.max(0, gross - platformFee));

  return {
    grossAmount: gross,
    platformFee,
    creatorNetAmount,
    platformFeeBps: feeBps,
  };
}

export function getTreasuryConfig() {
  const wallet = process.env.PROOVRA_TREASURY_WALLET?.trim() || null;
  const email = process.env.PROOVRA_TREASURY_EMAIL?.trim() || null;

  return {
    wallet,
    email,
    configured: Boolean(wallet || email),
  };
}
