"use client";

import Link from "next/link";

type SidebarSection = "profile" | "inventory" | "transactions" | "statistics" | "settings" | "support";

type NavigationItem = {
  label: string;
  href: string;
  section: SidebarSection;
};

const navigation: NavigationItem[] = [
  { label: "Профиль", href: "/account", section: "profile" },
  { label: "Инвентарь", href: "/account/inventory", section: "inventory" },
  { label: "История транзакций", href: "/account/operations", section: "transactions" },
  { label: "Статистика", href: "/account/statistics", section: "statistics" },
  { label: "Настройки", href: "/account/settings", section: "settings" },
  { label: "Поддержка", href: "/account/support", section: "support" },
];

function NavigationIcon({ section }: { section: SidebarSection }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 shrink-0">
      {section === "profile" && <path {...commonProps} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />}
      {section === "inventory" && <path {...commonProps} d="M4 8.5 6 4h12l2 4.5M5 8h14v11H5V8Zm4 0v3h6V8" />}
      {section === "transactions" && <path {...commonProps} d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />}
      {section === "statistics" && <path {...commonProps} d="M5 20v-5m7 5V9m7 11V4M3 20h18" />}
      {section === "settings" && <path {...commonProps} d="m12 3 1.2 2.4 2.7.4 1.9-1.6 1.9 1.9-1.6 1.9.4 2.7L21 12l-2.5 1.2-.4 2.7 1.6 1.9-1.9 1.9-1.9-1.6-2.7.4L12 21l-1.2-2.5-2.7-.4-1.9 1.6-1.9-1.9 1.6-1.9-.4-2.7L3 12l2.5-1.2.4-2.7-1.6-1.9 1.9-1.9 1.9 1.6 2.7-.4L12 3Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />}
      {section === "support" && <path {...commonProps} d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h2v5H4v-5Zm16 0h-2v5h2v-5ZM8 20h4" />}
    </svg>
  );
}

export default function SidebarNav({ active }: { active: SidebarSection }) {
  return (
    <nav className="space-y-2" aria-label="Навигация аккаунта">
      {navigation.map((item) => {
        const isActive = item.section === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex min-h-[58px] w-full items-center gap-4 rounded-[18px] border px-4 py-3 text-left text-[0.92rem] font-semibold tracking-[0.01em] transition ${isActive ? "border-violet-500/70 bg-[linear-gradient(100deg,rgba(91,28,178,0.38),rgba(45,18,91,0.18))] text-white shadow-[0_0_24px_rgba(124,58,237,0.28),inset_0_0_18px_rgba(168,85,247,0.12)]" : "border-transparent bg-transparent text-slate-300 hover:border-violet-400/25 hover:bg-violet-500/[0.06] hover:text-white"}`}
          >
            <span className={`transition ${isActive ? "text-violet-200 drop-shadow-[0_0_10px_rgba(192,132,252,0.85)]" : "text-violet-200/90 group-hover:text-violet-100 group-hover:drop-shadow-[0_0_8px_rgba(192,132,252,0.7)]"}`}>
              <NavigationIcon section={item.section} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export type { SidebarSection };
