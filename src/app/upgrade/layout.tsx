import type { ReactNode } from "react";
import RecoveryCaseWatcher from "./RecoveryCaseWatcher";

export default function UpgradeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <RecoveryCaseWatcher />
    </>
  );
}
