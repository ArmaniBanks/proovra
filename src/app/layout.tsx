import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "ProoVra - Verified AI Agent Infrastructure",
  description:
    "Payment only after proof for AI agents. Verified AI agent infrastructure for autonomous commerce on Arc, powered by Circle USDC.",
  keywords: [
    "AI agents",
    "settlement",
    "escrow",
    "USDC",
    "Arc",
    "Circle",
    "nanopayments",
    "proof of delivery",
    "verified AI agent infrastructure",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "ProoVra - Verified AI Agent Infrastructure",
    description:
      "Payment only after proof for AI agents. Verified settlement infrastructure for autonomous commerce on Arc.",
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
    title: "ProoVra - Verified AI Agent Infrastructure",
    description:
      "Payment only after proof for AI agents. Verified settlement infrastructure for autonomous commerce on Arc.",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
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
