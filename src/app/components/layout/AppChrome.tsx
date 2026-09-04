"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import MobileBottomNav from "../mobile/MobileBottomNav";
import SiteFooter from "./SiteFooter";

function detectMobileDevice() {
  if (typeof window === "undefined") return false;
  const viewportMobile = window.matchMedia("(max-width: 767px)").matches;
  const touchDevice = navigator.maxTouchPoints > 0;
  const compactTouchDevice = touchDevice && Math.min(window.innerWidth, window.screen.width) <= 1024;
  return viewportMobile || compactTouchDevice;
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBetaGate = pathname === "/beta" || pathname.startsWith("/beta/");
  const isAgreement = pathname === "/agreement";
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const updateDevice = () => setIsMobileDevice(detectMobileDevice());
    updateDevice();
    window.addEventListener("resize", updateDevice);
    window.addEventListener("orientationchange", updateDevice);
    return () => {
      window.removeEventListener("resize", updateDevice);
      window.removeEventListener("orientationchange", updateDevice);
    };
  }, []);

  const pageClass = isBetaGate || isAgreement
    ? "min-h-screen"
    : isMobileDevice
      ? "min-h-screen pb-24"
      : "min-h-screen";

  return (
    <>
      <div className={pageClass}>{children}</div>
      {!isBetaGate && !isAgreement && <SiteFooter />}
      {!isBetaGate && !isAgreement && <MobileBottomNav />}
    </>
  );
}
