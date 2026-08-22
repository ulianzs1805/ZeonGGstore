import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import MobileBottomNav from "./components/mobile/MobileBottomNav";

export const metadata: Metadata = {
  title: "ZeonGGStore",
  description: "Closed beta storefront",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen pb-24 md:pb-0">{children}</div>
          <MobileBottomNav />
        </Providers>
      </body>
    </html>
  );
}
