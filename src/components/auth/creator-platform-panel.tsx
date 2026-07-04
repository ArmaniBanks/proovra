"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Ghost,
  Link2,
  Lock,
  MessageSquare,
  Rss,
  Sparkles,
} from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { hasPrivyConfig } from "@/lib/privy-config";

type Platform = "ghost" | "rsshub" | "discourse" | "docs";

type PlatformProfile = {
  id: Platform;
  name: string;
  label: string;
  icon: React.ElementType;
  audience: string;
  reach: string;
  unlock: string;
  inputLabel: string;
  placeholder: string;
  path: string[];
  sampleItems: string[];
};

const platformProfiles: PlatformProfile[] = [
  {
    id: "ghost",
    name: "Ghost",
    label: "Best first wedge",
    icon: Ghost,
    audience: "Writers, newsletters, indie publications, research blogs",
    reach: "Large creator ecosystem with feeds, members, newsletters, and public APIs.",
    unlock:
      "Paid agent reads, citation fees, research-note access, and premium archive licensing.",
    inputLabel: "Ghost publication URL",
    placeholder: "https://publication.example.com",
    path: [
      "Connect Ghost publication or public feed",
      "Import posts and premium archive candidates",
      "Select articles agents can pay to read or cite",
      "Expose x402 endpoints for each selected article",
    ],
    sampleItems: [
      "Premium market analysis post",
      "Founder essay with original data",
      "Newsletter archive agents can cite",
    ],
  },
  {
    id: "rsshub",
    name: "RSS / RSSHub",
    label: "Fastest onboarding",
    icon: Rss,
    audience: "Any creator with an RSS feed, blog, podcast notes, or public updates",
    reach:
      "Universal feed surface; RSSHub-style routes make many platforms agent-readable.",
    unlock:
      "Paid feeds, per-source citation tolls, and low-friction monetization for existing posts.",
    inputLabel: "RSS feed or RSSHub route",
    placeholder: "https://creator.example.com/rss.xml",
    path: [
      "Paste feed URL",
      "Preview feed items",
      "Pick content to monetize",
      "Turn each item into a paid JSON endpoint",
    ],
    sampleItems: [
      "Latest creator essay",
      "Podcast research links",
      "Public changelog agents monitor",
    ],
  },
  {
    id: "discourse",
    name: "Discourse",
    label: "Community knowledge",
    icon: MessageSquare,
    audience: "Communities with valuable threads, support answers, and expert discussions",
    reach:
      "Mature forum ecosystem with APIs and high-signal community knowledge bases.",
    unlock:
      "Paid access to best threads, accepted answers, gated categories, and source-grounded citations.",
    inputLabel: "Discourse community URL",
    placeholder: "https://forum.example.com",
    path: [
      "Connect community URL",
      "Import public categories or selected threads",
      "Mark high-value answers as paid agent sources",
      "Route agent access through x402 receipts",
    ],
    sampleItems: [
      "Solved technical support thread",
      "Community research roundup",
      "Expert answer agents can cite",
    ],
  },
  {
    id: "docs",
    name: "Docs Site",
    label: "Developer content",
    icon: FileText,
    audience: "SDK docs, API guides, tutorials, and technical explainers",
    reach:
      "Great for developer communities where agents already retrieve docs during coding tasks.",
    unlock:
      "Paid docs snippets, source citations, per-answer grounding fees, and agent usage analytics.",
    inputLabel: "Docs sitemap or page URL",
    placeholder: "https://docs.example.com/sitemap.xml",
    path: [
      "Connect sitemap or docs page",
      "Import pages with canonical URLs",
      "Select pages worth charging agents for",
      "Expose paid markdown/JSON resources",
    ],
    sampleItems: [
      "API authentication guide",
      "Integration tutorial",
      "Troubleshooting page agents often quote",
    ],
  },
];

export function CreatorPlatformPanel() {
  if (!hasPrivyConfig) {
    return (
      <DisabledPlatformPanel reason="Configure Privy to unlock creator platform connections." />
    );
  }

  return <PrivyPlatformPanel />;
}

function DisabledPlatformPanel({ reason }: { reason: string }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-zinc-500" />
        <h2 className="text-sm font-semibold text-zinc-100">
          Connect Content Platform
        </h2>
      </div>
      <p className="text-sm leading-6 text-zinc-500">{reason}</p>
    </section>
  );
}

function PrivyPlatformPanel() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [platform, setPlatform] = useState<Platform>("ghost");
  const [url, setUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const selected = useMemo(
    () => platformProfiles.find((profile) => profile.id === platform) ?? platformProfiles[0],
    [platform]
  );
  const wallet =
    wallets.find((candidate) => candidate.walletClientType === "privy") ?? wallets[0];
  const Icon = selected.icon;

  if (!authenticated) {
    return (
      <DisabledPlatformPanel reason="Login with email first, then connect Ghost, RSS/RSSHub, Discourse, or docs sources from your creator dashboard." />
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Acquisition wedge
          </div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Connect a platform with creators we can actually reach
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Start where creators already publish and where APIs, feeds, or plugins
            make agent-readable monetization possible. ProoVra attaches x402
            payments from the outside instead of asking creators to migrate.
          </p>
        </div>
        {wallet && (
          <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 font-mono text-[11px] text-zinc-400">
            Arc wallet {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </span>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {platformProfiles.map((profile) => {
          const ProfileIcon = profile.icon;
          const active = profile.id === platform;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => {
                setPlatform(profile.id);
                setConnected(false);
                setUrl("");
              }}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <ProfileIcon
                  className={active ? "h-4 w-4 text-amber-400" : "h-4 w-4 text-zinc-500"}
                />
                <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-0.5 text-[10px] text-zinc-500">
                  {profile.label}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-100">{profile.name}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{profile.audience}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Icon className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {selected.name} monetization path
              </h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {selected.reach}
              </p>
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-xs font-medium text-amber-300">What ProoVra unlocks</p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{selected.unlock}</p>
          </div>
          <ol className="space-y-2">
            {selected.path.map((step, index) => (
              <li key={step} className="flex gap-3 text-xs leading-5 text-zinc-400">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 font-mono text-[10px] text-amber-300">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {selected.inputLabel}
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setConnected(false);
              }}
              placeholder={selected.placeholder}
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500/50"
            />
            <button
              type="button"
              disabled={!url.trim()}
              onClick={() => setConnected(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
            >
              {connected ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {connected ? "Connected" : "Connect"}
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs font-medium text-zinc-300">Import preview</p>
            <div className="mt-3 space-y-2">
              {selected.sampleItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                >
                  <span className="text-xs text-zinc-400">{item}</span>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                    x402 ready
                  </span>
                </div>
              ))}
            </div>
          </div>

          {connected && (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-xs font-medium text-emerald-300">
                {selected.name} source connected
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Next: pick imported items, set a per-access USDC price, and publish
                x402 endpoints for agents to pay before reading or citing.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
