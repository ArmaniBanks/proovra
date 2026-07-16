import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Rss,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ProoVraMark } from "@/components/brand/proovra-mark";
import { db } from "@/lib/db";
import { CreatorContentService } from "@/services/creator-content.service";
import { CreatorProfileService } from "@/services/creator-profile.service";
import { ResourceUnlockPanel } from "./resource-unlock-panel";

export const dynamic = "force-dynamic";

type ResourcePageProps = {
  params: Promise<{ id: string }>;
};

function hostnameFromUrl(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sourceLabel(source: "manual" | "rss", sourceUrl?: string) {
  const host = hostnameFromUrl(sourceUrl);
  if (!host) return source === "rss" ? "RSS" : "ProoVra";
  if (host.includes("medium.com")) return "Medium";
  if (host.includes("substack.com")) return "Substack";
  if (host.includes("ghost.io")) return "Ghost";
  if (host.includes("beehiiv.com")) return "Beehiiv";
  if (host.includes("wordpress.com")) return "WordPress";
  return source === "rss" ? "RSS" : host;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

async function getResource(id: string) {
  await db.ready();
  const content = CreatorContentService.getContentById(id);
  if (!content || content.status !== "published") return null;

  const accesses = CreatorContentService.getAccesses(id);
  const lastAccess = accesses[0];
  const profile = CreatorProfileService.getProfile(content.creatorWallet);
  const publicName = CreatorProfileService.getPublicName(
    content.creatorWallet,
    content.creatorName
  );
  const economics = CreatorContentService.quoteRevenue(content.price);

  return {
    content,
    accesses,
    lastAccess,
    profile,
    publicName,
    economics,
    sourceName: sourceLabel(content.source, content.sourceUrl),
    sourceDomain: hostnameFromUrl(content.sourceUrl),
  };
}

export async function generateMetadata({
  params,
}: ResourcePageProps): Promise<Metadata> {
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource) {
    return {
      title: "Paid Resource Not Found - ProoVra",
    };
  }

  return {
    title: `${resource.content.title} - ProoVra`,
    description: resource.content.description,
    openGraph: {
      title: resource.content.title,
      description: resource.content.description,
      type: "article",
    },
  };
}

export default async function ResourcePage({ params }: ResourcePageProps) {
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource) notFound();

  const { content, economics, profile, publicName } = resource;
  const username = profile?.username ? `@${profile.username}` : "@creator";
  const isVerified = content.source === "rss";

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
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Marketplace
          </Link>
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:py-12">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              <Rss className="h-3.5 w-3.5" />
              {resource.sourceName}
            </span>
            {isVerified && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified source
              </span>
            )}
          </div>

          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
            {content.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-400">
            {content.description}
          </p>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-600">
                  Creator
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-zinc-100">{publicName}</p>
                  <span className="rounded-full border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                    {username}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                </div>
              </div>
              {content.sourceUrl && (
                <a
                  href={content.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-amber-500/30 hover:text-amber-300"
                >
                  Source
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label="Paid accesses"
              value={content.accessCount}
            />
            <StatCard
              icon={Clock3}
              label="Last purchased"
              value={
                resource.lastAccess
                  ? formatDate(resource.lastAccess.accessedAt)
                  : "Not yet"
              }
            />
            <StatCard
              icon={CalendarDays}
              label="Published"
              value={formatDate(content.createdAt)}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-600">Source</p>
            <p className="mt-2 text-sm font-medium text-zinc-200">
              {resource.sourceName}
            </p>
            {resource.sourceDomain && (
              <p className="mt-1 text-sm text-zinc-500">{resource.sourceDomain}</p>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ResourceUnlockPanel
            contentId={content.id}
            title={content.title}
            price={content.price}
            creatorReceives={economics.creatorNetAmount}
            platformFee={economics.platformFee}
          />
        </aside>
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="mb-3 inline-flex rounded-lg bg-amber-500/10 p-2">
        <Icon className="h-4 w-4 text-amber-300" />
      </div>
      <p className="font-mono text-xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
