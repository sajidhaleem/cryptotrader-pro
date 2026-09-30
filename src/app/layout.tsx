import type { Metadata } from "next";
import { Geist, Geist_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";
import { isOwner } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Designed by the Braille Institute specifically for low-vision readers —
// strong disambiguation between characters (0/O, 1/l/I) that matters most
// in dense numeric displays (prices, P&L, portfolio figures).
const atkinsonHyperlegible = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CryptoTrader Pro — AI-Powered Binance Trading",
  description: "Trade smarter with AI signals, automated bots, and real-time portfolio analytics powered by Binance.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const owner = await isOwner();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${atkinsonHyperlegible.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {!owner && (
          <div className="fixed left-1/2 top-2 z-[100] -translate-x-1/2 rounded-full border border-amber-400/40 bg-[#1a1408]/95 px-3.5 py-1 text-xs text-amber-200 shadow-lg backdrop-blur">
            Read-only demo, no exchange account connected ·{" "}
            <a href="/owner" className="underline underline-offset-2 hover:text-white">Owner</a>
          </div>
        )}
      </body>
    </html>
  );
}
