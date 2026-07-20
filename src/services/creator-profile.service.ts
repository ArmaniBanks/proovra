import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { CreatorProfile } from "@/lib/mock-data";

type SaveCreatorProfileInput = {
  creatorWallet: string;
  email?: string;
  displayName: string;
  username: string;
};

function profileId(wallet: string) {
  return `creator-${createHash("sha256")
    .update(wallet.toLowerCase())
    .digest("hex")
    .slice(0, 12)}`;
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export class CreatorProfileService {
  static getProfile(creatorWallet: string): CreatorProfile | undefined {
    return db.creatorProfiles.get(creatorWallet.toLowerCase());
  }

  static getProfileByUsername(username: string): CreatorProfile | undefined {
    const normalizedUsername = normalizeUsername(username);
    return Array.from(db.creatorProfiles.values()).find(
      (profile) => profile.username.toLowerCase() === normalizedUsername
    );
  }

  static getPublicName(creatorWallet: string, fallbackName?: string) {
    const profile = this.getProfile(creatorWallet);
    if (profile?.displayName.trim()) return profile.displayName;
    if (fallbackName && !isEmailLike(fallbackName)) return fallbackName;
    return "ProoVra Creator";
  }

  static saveProfile(input: SaveCreatorProfileInput): CreatorProfile {
    const creatorWallet = input.creatorWallet.trim();
    const displayName = input.displayName.trim().slice(0, 60);
    const username = normalizeUsername(input.username);
    if (!/^0x[a-fA-F0-9]{40}$/.test(creatorWallet)) {
      throw new Error("A valid creator wallet is required.");
    }
    if (displayName.length < 2) {
      throw new Error("Public display name must be at least 2 characters.");
    }
    if (username.length < 3) {
      throw new Error("Username must be at least 3 letters, numbers, or underscores.");
    }

    const existing = this.getProfile(creatorWallet);
    const now = new Date();
    const profile: CreatorProfile = {
      id: existing?.id ?? profileId(creatorWallet),
      creatorWallet,
      email: input.email?.trim() || existing?.email,
      displayName,
      username,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    db.creatorProfiles.set(creatorWallet.toLowerCase(), profile);
    for (const content of db.creatorContents.values()) {
      if (content.creatorWallet.toLowerCase() !== creatorWallet.toLowerCase()) {
        continue;
      }
      content.creatorName = displayName;
      content.updatedAt = now;
      db.creatorContents.set(content.id, content);
    }
    return profile;
  }
}
