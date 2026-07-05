"use client";

import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Rss,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ProoVraMark } from "@/components/brand/proovra-mark";

const feedGuides = [
  {
    platform: "Medium",
    format: "https://medium.com/feed/@username",
    example: "https://medium.com/feed/@0xnald",
    notes: "Use the Medium handle after @. Public stories are imported.",
  },
  {
    platform: "Substack",
    format: "https://yourname.substack.com/feed",
    example: "https://example.substack.com/feed",
    notes: "Works for public publication posts.",
  },
  {
    platform: "Ghost",
    format: "https://yourdomain.com/rss/",
    example: "https://demo.ghost.io/rss/",
    notes: "Ghost sites expose RSS at /rss/ by default.",
  },
  {
    platform: "WordPress",
    format: "https://yourdomain.com/feed/",
    example: "https://example.com/feed/",
    notes: "Works for public WordPress posts. OAuth support can be added later.",
  },
  {
    platform: "Beehiiv",
    format: "https://your-publication-domain/feed",
    example: "https://example.beehiiv.com/feed",
    notes: "Use the public publication domain, including custom domains.",
  },
  {
    platform: "Personal Blog",
    format: "https://yourdomain.com/rss.xml or /feed.xml",
    example: "https://creator.dev/rss.xml",
    notes: "Any public RSS/Atom feed with same-domain items can work.",
  },
];

const steps = [
  "Launch App and sign in with email.",
  "Save a public creator profile with a display name and username.",
  "Open Content and paste your public RSS feed URL.",
  "Copy the ProoVra verification code into your feed, homepage, meta tag, or public same-domain page.",
  "Verify ownership, select a feed item, set a USDC price, and monetize it.",
  "Agents discover the metadata, pay through x402, and receive the gated JSON content.",
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <nav className="border-b border-zinc-800/60 bg-[#09090b]/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <ProoVraMark size={34} priority />
            <span className="text-lg font-semibold tracking-tight">
              Proo<span className="text-amber-400">Vra</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/docs" className="text-sm font-medium text-amber-300">
              Docs
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
            >
              Launch App
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden self-start rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 lg:block lg:sticky lg:top-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <BookOpen className="h-4 w-4 text-amber-400" />
            ProoVra Docs
          </div>
          {["Creator onboarding", "RSS feed URLs", "Ownership verification", "Agent payments"].map(
            (item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
                className="block rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
              >
                {item}
              </a>
            )
          )}
        </aside>

        <article className="space-y-8">
          <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-zinc-900/70 to-zinc-950 p-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-300">
              <BookOpen className="h-3.5 w-3.5" />
              Creator guide
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Creator onboarding for paid agent access.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Use this guide to connect creator-owned RSS content, verify
              ownership, set a USDC price, and expose content through x402-gated
              APIs for AI agents.
            </p>
          </section>

          <DocSection id="creator-onboarding" title="Creator Onboarding" icon={Wallet}>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-zinc-950">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-zinc-300">{step}</p>
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="rss-feed-urls" title="Supported RSS Feed URLs" icon={Rss}>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <div className="grid grid-cols-[0.7fr_1.4fr_1.4fr] border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <span>Platform</span>
                <span>Feed format</span>
                <span>Notes</span>
              </div>
              {feedGuides.map((feed) => (
                <div
                  key={feed.platform}
                  className="grid gap-3 border-b border-zinc-800/70 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[0.7fr_1.4fr_1.4fr]"
                >
                  <div className="font-semibold text-zinc-100">{feed.platform}</div>
                  <div>
                    <code className="break-all rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-amber-300">
                      {feed.format}
                    </code>
                    <p className="mt-2 break-all text-xs text-zinc-600">
                      Example: {feed.example}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-zinc-400">{feed.notes}</p>
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="ownership-verification" title="Ownership Verification" icon={ShieldCheck}>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                "Add the verification code to a new RSS post.",
                "Add the code to the homepage or a meta tag.",
                "Add the code to a public page on the same domain.",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-300" />
                  <p className="text-sm leading-6 text-zinc-300">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-500">
              ProoVra only monetizes public RSS items from verified feeds/domains.
              It should not be used to scrape private, paywalled, or third-party
              content without permission.
            </p>
          </DocSection>

          <DocSection id="agent-payments" title="Agent Payments" icon={ExternalLink}>
            <p className="text-sm leading-6 text-zinc-400">
              Agents start at <code className="text-amber-300">/api/agent/discover</code>,
              request the listed access URL, receive <code className="text-amber-300">402 Payment Required</code>,
              then pay through Circle Gateway x402 on Arc Testnet. Once payment
              settles, ProoVra returns the authorized JSON content and records
              the receipt.
            </p>
          </DocSection>
        </article>
      </div>
    </main>
  );
}

function DocSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-amber-500/10 p-2">
          <Icon className="h-5 w-5 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}
