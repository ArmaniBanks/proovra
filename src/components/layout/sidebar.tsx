"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";
import { ProoVraMark } from "@/components/brand/proovra-mark";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[220px] flex-col border-r border-[#1e1e22] bg-[#0c0c0f]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[#1e1e22] px-5">
        <ProoVraMark size={30} priority />
        <Link href="/" className="flex items-baseline gap-1">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            ProoVra
          </span>
          <span className="text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
            v1
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
          Platform
        </div>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-amber-500/8 text-amber-500 border border-amber-500/15"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      isActive
                        ? "text-amber-500"
                        : "text-zinc-500 group-hover:text-zinc-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-[#1e1e22] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
          <span className="uppercase tracking-wider">Paid on</span>
          <span className="font-semibold text-zinc-500">Arc</span>
          <span className="text-zinc-700">·</span>
          <span className="font-semibold text-zinc-500">USDC</span>
        </div>
        <a
          href="https://developers.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-amber-500 transition-colors"
        >
          <span>Circle Developer Platform</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </aside>
  );
}
