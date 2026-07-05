"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  FileText,
  Lock,
  Newspaper,
  Receipt,
} from "lucide-react";
import { ProoVraMark } from "@/components/brand/proovra-mark";
import { formatUSDC } from "@/lib/utils";

type CreatorSummary = {
  summary: {
    publishedCount: number;
    totalAccesses: number;
    totalEarned: number;
    activeCreators: number;
  };
};

const flow = [
  {
    icon: Newspaper,
    title: "Creator Publishes",
    text: "A creator selects content they own from a post, feed, docs page, or manual resource.",
  },
  {
    icon: CircleDollarSign,
    title: "Price Is Set",
    text: "The creator sets a USDC nanoprice for agent read, cite, summarize, or reuse access.",
  },
  {
    icon: Lock,
    title: "x402 Gate Opens",
    text: "Agents hit a ProoVra API endpoint and receive a 402 challenge until payment is made.",
  },
  {
    icon: Receipt,
    title: "Access Is Receipted",
    text: "After payment settles on Arc, ProoVra returns clean JSON content and records the receipt.",
  },
];

export default function LandingPage() {
  const [summary, setSummary] = useState<CreatorSummary["summary"] | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      try {
        const response = await fetch("/api/creator-content", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as CreatorSummary;
        if (active) setSummary(payload.summary);
      } catch {
        // Keep the landing page usable if the API is unavailable.
      }
    }
    void loadSummary();
    return () => {
      active = false;
    };
  }, []);

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
            <Link href="/docs" className="text-sm font-medium text-zinc-400 transition-colors hover:text-amber-300">
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

      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-dot-grid opacity-35" />
        <div className="absolute left-1/2 top-0 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-amber-500/[0.05] blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-300">
            <Bot className="h-3.5 w-3.5" />
            Paid creator content for AI agents
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Let creators charge agents for reading their work.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
            ProoVra turns creator-owned posts, docs, feeds, and research notes into
            x402-protected APIs. Agents pay USDC nanopayments on Arc before they can
            read, cite, or reuse the content.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/content"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-7 py-3.5 text-sm font-semibold text-zinc-950 shadow-xl shadow-amber-500/20 transition-colors hover:bg-amber-400"
            >
              Publish Paid Content
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="/agents"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-7 py-3.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Watch Agent Pay
              <FileText className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-800/60 bg-zinc-950/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          <Stat label="Published" value={summary?.publishedCount ?? 0} />
          <Stat label="Paid Accesses" value={summary?.totalAccesses ?? 0} />
          <Stat label="Creator Earnings" value={formatUSDC(summary?.totalEarned ?? 0)} />
          <Stat label="Creators" value={summary?.activeCreators ?? 0} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">
            Built around the exact agent-payment moment.
          </h2>
          <p className="mt-4 text-sm leading-6 text-zinc-500">
            The core product is not generic escrow. It is paid, authorized access to
            creator-owned content that agents can consume programmatically.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-4">
          {flow.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-4 inline-flex rounded-lg bg-amber-500/10 p-2">
                  <Icon className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-zinc-100">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-zinc-800/40 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-zinc-600 sm:flex-row sm:px-6">
          <span>Built for Lepton Hackathon · Circle x402 · Arc · USDC</span>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-zinc-500 transition-colors hover:text-amber-400">
              Docs
            </Link>
            <Link href="/dashboard" className="text-zinc-500 transition-colors hover:text-amber-400">
              Launch App →
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="font-mono text-2xl font-bold text-amber-400 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </p>
    </div>
  );
}
