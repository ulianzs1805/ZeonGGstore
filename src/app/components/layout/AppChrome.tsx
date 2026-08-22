"use client";

import { usePathname } from "next/navigation";
import MobileBottomNav from "../mobile/MobileBottomNav";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBetaGate = pathname === "/beta" || pathname.startsWith("/beta/");

  return (
    <>
      <div className={isBetaGate ? "min-h-screen" : "min-h-screen pb-24 md:pb-0"}>
        {children}
      </div>
      {!isBetaGate && <MobileBottomNav />}
    </>
  );
}
