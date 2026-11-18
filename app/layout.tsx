import type { Metadata, Viewport } from "next";
import "@fontsource-variable/funnel-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

// Same fonts as Surflog: Funnel Sans (variable 300–800) for everything you
// read, IBM Plex Mono for figures. Self-hosted from npm (@fontsource) instead
// of next/font/google, so builds don't depend on reaching Google Fonts.
// Neither has CJK glyphs; Chinese falls back to the system font per glyph,
// as in Surflog.

export const metadata: Metadata = {
  title: { default: "Vocab", template: "%s · Vocab" },
  description: "My English vocabulary notebook",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f5f5f6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
