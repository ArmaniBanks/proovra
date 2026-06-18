import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatUSDC(amount: number): string {
  if (!Number.isFinite(amount)) return "$0.00";

  if (amount < 0.01) {
    return `$${Number(amount.toFixed(6)).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    })}`;
  }
  if (amount < 1) {
    return `$${Number(amount.toFixed(4)).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    })}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Number(value.toFixed(1)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

export function formatReputationScore(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toString();
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimeAgo(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diff = new Date().getTime() - date.getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function formatTimestamp(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function generateHash(): string {
  const chars = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function generateShortId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "PV-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
