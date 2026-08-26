import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import AppChrome from "./components/layout/AppChrome";

export const metadata: Metadata = {
  title: {
    default: "ZeonGGStore",
    template: "%s | ZeonGGStore",
  },
  description: "ZeonGGStore — кейсы, дропы и апгрейд скинов в закрытой бете.",
  applicationName: "ZeonGGStore",
  icons: {
    icon: "/zeongg-logo.webp",
    apple: "/zeongg-logo.webp",
  },
  openGraph: {
    title: "ZeonGGStore",
    description: "Кейсы, дропы и апгрейд скинов.",
    images: [{ url: "/zeongg-logo.webp", width: 128, height: 128, alt: "ZeonGGStore" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
