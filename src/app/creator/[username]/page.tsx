import type { Metadata } from "next";
import type { ElementType } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Newspaper,
  Rss,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ProoVraMark } from "@/components/brand/proovra-mark";
import { db } from "@/lib/db";
import { formatUSDC } from "@/lib/utils";
import { CreatorContentService } from "@/services/creator-content.service";
import { CreatorProfileService } from "@/services/creator-profile.service";

export const dynamic = "force-dynamic";

type CreatorPublicationPageProps = {
  params: Promise<{ username: string }>;
};

function sourceLabel(sourceUrl?: string) {
  if (!sourceUrl) return "ProoVra";
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    if (host.includes("medium.com")) return "Medium";
    if (host.includes("substack.com")) return "Substack";
    if (host.includes("ghost.io")) return "Ghost";
    if (host.includes("beehiiv.com")) return "Beehiiv";
    if (host.includes("wordpress.com")) return "WordPress";
    return host;
  } catch {
    return "RSS";
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

async function getCreatorPublication(username: string) {
  await db.ready();
  const profile = CreatorProfileService.getProfileByUsername(username);
  if (!profile) return null;

  const contents = CreatorContentService.getContent(profile.creatorWallet).filter(
    (content) => content.status === "published"
  );
  const accesses = CreatorContentService.getAccesses(undefined, profile.creatorWallet);
  const summary = CreatorContentService.getSummary(profile.creatorWallet);
  const verifiedSources = Array.from(db.creatorRssVerifications.values()).filter(
    (verification) =>
      verification.creatorWallet.toLowerCase() ===
        profile.creatorWallet.toLowerCase() &&
      verification.status === "verified"
  );

  return { profile, contents, accesses, summary, verifiedSources };
}

export async function generateMetadata({
  params,
}: CreatorPublicationPageProps): Promise<Metadata> {
  const { username } = await params;
  const publication = await getCreatorPublication(username);
  if (!publication) {
    return { title: "Creator Not Found - ProoVra" };
  }

  return {
    title: `${publication.profile.displayName} - ProoVra`,
    description: `Paid agent-readable resources by ${publication.profile.displayName}.`,
  };
}

export default async function CreatorPublicationPage({
  params,
}: CreatorPublicationPageProps) {
  const { username } = await params;
  const publication = await getCreatorPublication(username);
  if (!publication) notFound();

  const { profile, contents, accesses, summary, verifiedSources } = publication;
  const lastAccess = accesses[0];

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

      <section className="border-b border-zinc-800/60 bg-zinc-950/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified creator
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-400">
              @{profile.username}
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {profile.displayName}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Public ProoVra publication page for creator-owned resources that
            agents can pay to unlock.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Newspaper}
              label="Published resources"
              value={summary.publishedCount}
            />
            <StatCard
              icon={Users}
              label="Paid accesses"
              value={summary.totalAccesses}
            />
            <StatCard
              icon={CircleDollarSign}
              label="Creator net"
              value={formatUSDC(summary.totalEarned)}
            />
            <StatCard
              icon={CalendarDays}
              label="Last purchased"
              value={lastAccess ? formatDate(lastAccess.accessedAt) : "Not yet"}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Paid Resources
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Open a resource page to request access, pay, and unlock content.
            </p>
          </div>

          {contents.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
              <Newspaper className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
              <p className="text-sm font-medium text-zinc-400">
                No published resources yet
              </p>
            </div>
          ) : (
            contents.map((content) => {
              const economics = CreatorContentService.quoteRevenue(content.price);
              return (
                <article
                  key={content.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase text-amber-300">
                          {content.source === "rss" ? (
                            <Rss className="h-3.5 w-3.5" />
                          ) : (
                            <Newspaper className="h-3.5 w-3.5" />
                          )}
                          {sourceLabel(content.sourceUrl)}
                        </span>
                        {content.source === "rss" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verified source
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold text-zinc-100">
                        {content.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                        {content.description}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>{formatUSDC(content.price)} per access</span>
                        <span>{content.accessCount} paid accesses</span>
                        <span>
                          Creator receives {formatUSDC(economics.creatorNetAmount)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/r/${content.id}`}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
                    >
                      View Resource
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-semibold text-zinc-100">
              Verified Sources
            </h2>
            {verifiedSources.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No public RSS source is verified yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {verifiedSources.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3"
                  >
                    <p className="text-sm font-medium text-zinc-200">
                      {source.domain}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {source.feedUrl}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
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
  icon: ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-3 inline-flex rounded-lg bg-amber-500/10 p-2">
        <Icon className="h-4 w-4 text-amber-400" />
      </div>
      <p className="font-mono text-2xl font-semibold text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
