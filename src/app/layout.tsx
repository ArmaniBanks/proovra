import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "ProoVra - Proof-Gated Settlement Sidecar",
  description:
    "Proof-gated USDC settlement for existing digital work communities. Start with open-source contributor payouts on Arc Testnet.",
  keywords: [
    "settlement sidecar",
    "open source contributor payouts",
    "verified digital work",
    "AI agents",
    "settlement",
    "escrow",
    "USDC",
    "Arc",
    "Circle",
    "nanopayments",
    "proof of delivery",
    "proof-gated settlement",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "ProoVra - Proof-Gated Settlement Sidecar",
    description:
      "Attach USDC escrow, proof approval, payment release, and receipts to digital work communities that already exist.",
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
    title: "ProoVra - Proof-Gated Settlement Sidecar",
    description:
      "Attach USDC escrow, proof approval, payment release, and receipts to digital work communities that already exist.",
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
