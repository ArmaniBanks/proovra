import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "ProoVra - Paid Creator Content for AI Agents",
  description:
    "Turn creator-owned content into x402-protected APIs that AI agents pay to read, cite, summarize, or reuse on Arc Testnet.",
  keywords: [
    "creator monetization",
    "paid content APIs",
    "x402",
    "AI agents",
    "agent payments",
    "USDC",
    "Arc",
    "Circle",
    "nanopayments",
    "creator economy",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "ProoVra - Paid Creator Content for AI Agents",
    description:
      "Expose creator-owned content through x402-protected APIs so AI agents pay USDC nanopayments before access.",
    images: [
      {
        url: "/proovra-og.png",
        width: 1200,
        height: 630,
        alt: "ProoVra official logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProoVra - Paid Creator Content for AI Agents",
    description:
      "Expose creator-owned content through x402-protected APIs so AI agents pay USDC nanopayments before access.",
    images: ["/proovra-og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full"
      style={
        {
          "--font-inter":
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          "--font-jetbrains":
            "JetBrains Mono, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace",
        } as CSSProperties
      }
    >
      <body
        className="min-h-full bg-[#09090b] text-white antialiased"
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
