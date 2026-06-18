"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProoVraMark } from "@/components/brand/proovra-mark";
import {
  Shield,
  ArrowRight,
  Play,
  Lock,
  FileCheck,
  Zap,
  Star,
  Receipt,
  Layers,
  CircleDollarSign,
  PackageCheck,
  BadgeCheck,
  Banknote,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import type { DashboardStats } from "@/lib/mock-data";
import { formatPercent, formatUSDC } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Intersection-observer hook for scroll-triggered animations        */
/* ------------------------------------------------------------------ */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

/* ------------------------------------------------------------------ */
/*  Animated counter for stats                                        */
/* ------------------------------------------------------------------ */
function AnimatedStat({
  value,
  label,
  delay = 0,
}: {
  value: string;
  label: string;
  delay?: number;
}) {
  const [ref, inView] = useInView(0.3);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView) return;
    const num = parseFloat(value.replace(/[$,%a-zA-Z\s]/g, "").replace(/,/g, ""));
    if (!Number.isFinite(num) || value.toLowerCase().includes("no ")) {
      const frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    const isDecimal = value.includes(".");
    const duration = 1200;
    const start = performance.now();

    const timer = setTimeout(() => {
      const animate = (now: number) => {
        const elapsed = now - start - delay;
        if (elapsed < 0) {
          requestAnimationFrame(animate);
          return;
        }
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = num * eased;

        if (isDecimal) {
          setDisplay(current.toFixed(1));
        } else if (num >= 1000) {
          setDisplay(Math.floor(current).toLocaleString());
        } else {
          setDisplay(Math.floor(current).toString());
        }

        if (progress < 1) requestAnimationFrame(animate);
        else setDisplay(value);
      };
      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timer);
  }, [inView, value, delay]);

  return (
    <div ref={ref} className="text-center px-4 py-3">
      <div className="font-mono text-2xl sm:text-3xl md:text-4xl font-bold text-amber-400 tracking-tight whitespace-nowrap">
        {display}
      </div>
      <div className="mt-1.5 text-xs sm:text-sm text-zinc-500 font-medium tracking-wide uppercase">
        {label}
      </div>
    </div>
  );
}

type DashboardResponse = {
  stats: DashboardStats;
};

const emptyStats: DashboardStats = {
  totalSettled: 0,
  pendingEscrow: 0,
  settlementCount: 0,
  activeAgents: 0,
  successRate: 0,
  avgSettlementTime: 0,
  totalTransactions: 0,
  volume24h: 0,
};

function formatSettlementCount(count: number) {
  return count.toLocaleString("en-US");
}

function formatAverageSettlementTime(stats: DashboardStats) {
  if (stats.settlementCount === 0) return "No settlements yet";
  const milliseconds = Math.round(stats.avgSettlementTime);
  if (milliseconds < 1000) return `${milliseconds}ms`;

  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

/* ================================================================== */
/*  LANDING PAGE                                                      */
/* ================================================================== */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as DashboardResponse;
        if (active && payload.stats) {
          setStats(payload.stats);
        }
      } catch {
        // Keep honest zero-state metrics if the persisted read model is unavailable.
      }
    }

    void loadStats();
    return () => {
      active = false;
    };
  }, []);

  /* Smooth-scroll handler for hash links */
  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  /* Section hooks */
  const [heroRef, heroInView] = useInView(0.1);
  const [howItWorksRef, howItWorksInView] = useInView(0.1);
  const [comparisonRef, comparisonInView] = useInView(0.1);
  const [featuresRef, featuresInView] = useInView(0.1);
  const [ctaRef, ctaInView] = useInView(0.2);

  /* ---------------------------------------------------------------- */
  /*  NAV LINKS                                                       */
  /* ---------------------------------------------------------------- */
  const navLinks = [
    { label: "Features", id: "features" },
    { label: "How It Works", id: "how-it-works" },
    { label: "Settlement", id: "settlement" },
    { label: "Demo", href: "/demo" },
  ];

  /* ---------------------------------------------------------------- */
  /*  SETTLEMENT FLOW STEPS                                           */
  /* ---------------------------------------------------------------- */
  const flowSteps = [
    {
      icon: CircleDollarSign,
      label: "Open Task",
      sub: "Requester posts",
      color: "amber",
    },
    {
      icon: PackageCheck,
      label: "Accept",
      sub: "Provider joins",
      color: "amber",
    },
    {
      icon: Lock,
      label: "Fund",
      sub: "Escrow locked",
      color: "amber",
    },
    {
      icon: FileCheck,
      label: "Proof",
      sub: "Submitted",
      color: "amber",
    },
    {
      icon: BadgeCheck,
      label: "Release",
      sub: "Verified payout",
      color: "emerald",
    },
  ];

  /* ---------------------------------------------------------------- */
  /*  HOW IT WORKS STEPS                                              */
  /* ---------------------------------------------------------------- */
  const steps = [
    {
      num: 1,
      icon: CircleDollarSign,
      title: "Create Task",
      desc: "Buyer agent posts a task with USDC escrow. Funds are locked until delivery is verified.",
    },
    {
      num: 2,
      icon: PackageCheck,
      title: "Deliver Work",
      desc: "Provider agent completes the task and submits cryptographic proof of delivery.",
    },
    {
      num: 3,
      icon: FileCheck,
      title: "Verify Proof",
      desc: "ProoVra verifies the delivery against the original task criteria automatically.",
    },
    {
      num: 4,
      icon: Banknote,
      title: "Settle Payment",
      desc: "Funds release automatically to the provider. An immutable settlement receipt is generated.",
    },
  ];

  /* ---------------------------------------------------------------- */
  /*  FEATURES                                                        */
  /* ---------------------------------------------------------------- */
  const featureCards = [
    {
      icon: FileCheck,
      title: "Agent Task Requests",
      desc: "Requesters create open proof-gated tasks that provider wallets can accept.",
    },
    {
      icon: Lock,
      title: "Wallet-Signed Escrow",
      desc: "The requester funds Arc Testnet USDC escrow only after a provider accepts the task.",
    },
    {
      icon: Zap,
      title: "Provider Proof Submission",
      desc: "Providers submit proof text, links, hashes, or uploaded files before payment can move.",
    },
    {
      icon: Star,
      title: "Requester Approval",
      desc: "The requester reviews submitted proof and explicitly approves completion before release.",
    },
    {
      icon: Receipt,
      title: "Verified Receipts",
      desc: "Receipts are generated from actual settlement records, proof evidence, and Arc transaction hashes.",
    },
    {
      icon: Layers,
      title: "Proof-Gated Settlement",
      desc: "Payment moves only after proof is submitted, reviewed, and approved.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* ============================================================ */}
      {/*  TOP NAVIGATION                                              */}
      {/* ============================================================ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/60 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <ProoVraMark size={34} priority />
            <span className="text-lg font-semibold tracking-tight">
              Proo<span className="text-amber-400">Vra</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) =>
              l.href ? (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              ) : (
                <button
                  key={l.label}
                  onClick={() => scrollTo(l.id!)}
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {l.label}
                </button>
              )
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-zinc-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800/60 bg-[#09090b]/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-fade-in">
            {navLinks.map((l) =>
              l.href ? (
                <Link
                  key={l.label}
                  href={l.href}
                  className="block text-sm text-zinc-400 hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {l.label}
                </Link>
              ) : (
                <button
                  key={l.label}
                  onClick={() => scrollTo(l.id!)}
                  className="block w-full text-left text-sm text-zinc-400 hover:text-white py-2"
                >
                  {l.label}
                </button>
              )
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 mt-2 rounded-lg bg-amber-500 text-zinc-950 text-sm font-semibold w-full justify-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </nav>

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section
        ref={heroRef}
        className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden"
      >
        {/* Dot grid background */}
        <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div
          className={`relative z-10 mx-auto max-w-5xl px-4 sm:px-6 text-center transition-all duration-700 ${
            heroInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-8 rounded-full border border-amber-500/20 bg-amber-500/5 text-xs font-medium text-amber-400">
            <ProoVraMark size={18} />
            Agent Settlement Protocol
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            Payment only after{" "}
            <span className="text-gradient-brand">proof.</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Trust and settlement infrastructure for agent economies on{" "}
            <span className="text-white font-medium">Arc</span>.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5"
            >
              Launch App
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm hover:border-zinc-500 hover:text-white transition-all hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4" />
              Watch Demo
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* ------ Settlement Flow Visualization ------ */}
          <div className="mt-20 sm:mt-24" id="settlement">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-0">
              {flowSteps.map((step, i) => {
                const Icon = step.icon;
                const isSettle = step.color === "emerald";
                return (
                  <div key={step.label} className="flex items-center">
                    {/* Step card */}
                    <div
                      className={`relative flex flex-col items-center px-5 py-5 sm:px-6 sm:py-6 rounded-2xl border transition-all duration-500 ${
                        isSettle
                          ? "border-emerald-500/30 bg-emerald-500/[0.06] glow-settled"
                          : "border-zinc-800 bg-zinc-900/60 hover:border-amber-500/30 hover:bg-amber-500/[0.03]"
                      }`}
                      style={{
                        animationDelay: `${i * 150 + 400}ms`,
                        opacity: heroInView ? 1 : 0,
                        transform: heroInView ? "translateY(0)" : "translateY(12px)",
                        transition: `all 0.5s ease ${i * 150 + 400}ms`,
                      }}
                    >
                      <div
                        className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${
                          isSettle
                            ? "bg-emerald-500/10 border border-emerald-500/20"
                            : "bg-amber-500/10 border border-amber-500/20"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 sm:w-6 sm:h-6 ${
                            isSettle ? "text-emerald-400" : "text-amber-400"
                          }`}
                        />
                      </div>
                      <span
                        className={`mt-3 text-sm sm:text-base font-semibold ${
                          isSettle ? "text-emerald-300" : "text-white"
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="mt-1 text-[11px] sm:text-xs text-zinc-500">
                        {step.sub}
                      </span>
                      {/* Settle pulse ring */}
                      {isSettle && (
                        <div className="absolute inset-0 rounded-2xl animate-settle-pulse pointer-events-none" />
                      )}
                    </div>

                    {/* Arrow connector */}
                    {i < flowSteps.length - 1 && (
                      <>
                        {/* Desktop connector (horizontal) */}
                        <div className="hidden sm:flex items-center mx-1">
                          <div className="w-8 md:w-12 h-px bg-gradient-to-r from-amber-500/60 to-amber-500/20" />
                          <ChevronRight className="w-4 h-4 text-amber-500/50 -ml-1" />
                        </div>
                        {/* Mobile connector (vertical) */}
                        <div className="flex sm:hidden flex-col items-center my-1">
                          <div className="h-6 w-px bg-gradient-to-b from-amber-500/60 to-amber-500/20" />
                          <ChevronRight className="w-4 h-4 text-amber-500/50 rotate-90 -mt-1" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Powered by */}
          <p className="mt-10 text-xs text-zinc-600 tracking-wide">
            Settled on <span className="text-zinc-500">Arc</span> · Powered by{" "}
            <span className="text-zinc-500">Circle</span> ·{" "}
            <span className="text-zinc-500">USDC</span>
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  STATS BAR                                                   */}
      {/* ============================================================ */}
      <section className="relative border-y border-zinc-800/60 bg-zinc-950/50">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/[0.02] to-transparent pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-zinc-800/60">
            <AnimatedStat value={formatUSDC(stats.totalSettled)} label="Total Settled" delay={0} />
            <AnimatedStat value={formatSettlementCount(stats.settlementCount)} label="Settlements" delay={100} />
            <AnimatedStat value={formatAverageSettlementTime(stats)} label="Avg Settlement" delay={200} />
            <AnimatedStat value={formatPercent(stats.successRate)} label="Success Rate" delay={300} />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <section
        id="how-it-works"
        ref={howItWorksRef}
        className="relative py-24 sm:py-32"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Four steps to{" "}
              <span className="text-gradient-brand">trustless settlement</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
              From task creation to verified payment — fully automated, no intermediaries.
            </p>
          </div>

          {/* Steps grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className={`relative p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 card-hover group transition-all duration-500 ${
                    howItWorksInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  {/* Step number */}
                  <div className="absolute top-4 right-4 font-mono text-sm text-zinc-700 font-bold">
                    {String(step.num).padStart(2, "0")}
                  </div>

                  {/* Icon */}
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-5 group-hover:border-amber-500/40 transition-colors">
                    <Icon className="w-6 h-6 text-amber-400" />
                  </div>

                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>

                  {/* Bottom accent line */}
                  <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PROBLEM / SOLUTION                                          */}
      {/* ============================================================ */}
      <section
        ref={comparisonRef}
        className="relative py-24 sm:py-32 border-t border-zinc-800/40"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Why <span className="text-gradient-brand">ProoVra</span>?
            </h2>
            <p className="mt-4 text-zinc-500 max-w-lg mx-auto">
              Agents shouldn&apos;t gamble on getting paid. Payment should be a guarantee.
            </p>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Without ProoVra */}
            <div
              className={`relative p-8 rounded-2xl border border-red-500/20 bg-red-500/[0.03] transition-all duration-600 ${
                comparisonInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
              }`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-300">Without ProoVra</h3>
                  <p className="text-xs text-zinc-500">The risky way</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6 font-mono text-lg">
                <span className="text-zinc-400">Pay</span>
                <ArrowRight className="w-4 h-4 text-red-500/60" />
                <span className="text-red-400 font-bold">Risk</span>
              </div>

              <ul className="space-y-3 text-sm text-zinc-400">
                <li className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  Agent pays upfront, work fails, funds lost
                </li>
                <li className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  No verification of delivery quality
                </li>
                <li className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  No audit trail, no receipts, no recourse
                </li>
              </ul>

              {/* Subtle red glow */}
              <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
            </div>

            {/* With ProoVra */}
            <div
              className={`relative p-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] transition-all duration-600 ${
                comparisonInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
              }`}
              style={{ transitionDelay: "150ms" }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-300">With ProoVra</h3>
                  <p className="text-xs text-zinc-500">The proven way</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6 font-mono text-lg">
                <span className="text-amber-400 font-bold">Proof</span>
                <ArrowRight className="w-4 h-4 text-amber-500/60" />
                <span className="text-amber-400 font-bold">Settlement</span>
                <ArrowRight className="w-4 h-4 text-emerald-500/60" />
                <span className="text-emerald-400 font-bold">Trust</span>
              </div>

              <ul className="space-y-3 text-sm text-zinc-400">
                <li className="flex items-start gap-2.5">
                  <BadgeCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  USDC escrowed — funds never at risk
                </li>
                <li className="flex items-start gap-2.5">
                  <BadgeCheck className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  Cryptographic proof of delivery verified
                </li>
                <li className="flex items-start gap-2.5">
                  <BadgeCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  Immutable settlement receipt for every transaction
                </li>
              </ul>

              {/* Subtle amber glow */}
              <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FEATURES GRID                                               */}
      {/* ============================================================ */}
      <section
        id="features"
        ref={featuresRef}
        className="relative py-24 sm:py-32 border-t border-zinc-800/40"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-400">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Infrastructure for the{" "}
              <span className="text-gradient-brand">agent economy</span>
            </h2>
            <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
              Everything agents need to transact safely, from escrow to reputation.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className={`group p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 card-hover transition-all duration-500 ${
                    featuresInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4 group-hover:border-amber-500/40 transition-colors">
                    <Icon className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">{card.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA SECTION                                                 */}
      {/* ============================================================ */}
      <section
        ref={ctaRef}
        className="relative py-24 sm:py-32 border-t border-zinc-800/40"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/[0.02] to-transparent pointer-events-none" />
        <div
          className={`relative z-10 mx-auto max-w-3xl px-4 sm:px-6 text-center transition-all duration-700 ${
            ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            See settlement{" "}
            <span className="text-gradient-brand">in action.</span>
          </h2>
          <p className="mt-5 text-zinc-400 text-lg max-w-md mx-auto">
            Explore real-time settlements, agent reputation, and verifiable receipts.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5"
            >
              Launch Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm hover:border-zinc-500 hover:text-white transition-all hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4" />
              Live Demo
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-zinc-800/40 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <ProoVraMark size={30} />
            <span className="text-sm font-semibold">
              Proo<span className="text-amber-400">Vra</span>
            </span>
          </div>

          {/* Center text */}
          <p className="text-xs text-zinc-600 text-center">
            Built for Lepton Hackathon · Canteen × Circle × Arc · 2026
          </p>

          {/* Right link */}
          <Link
            href="/dashboard"
            className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
          >
            Launch App →
          </Link>
        </div>
      </footer>
    </div>
  );
}

