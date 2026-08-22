import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import AppChrome from "./components/layout/AppChrome";

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
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
