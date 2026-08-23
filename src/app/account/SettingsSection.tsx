"use client";

import { date } from "./account-types";
import type { ProfileData } from "./account-types";

export default function SettingsSection({ user, onResetBeta }: { user: ProfileData["user"]; onResetBeta: () => void }) {
  const role = user.role === "NPN1_DEV" ? "ZEON NPN 1 DEV" : user.role === "DEV" ? "ZEON DEV" : user.role === "ADMIN" ? "ZEON ADMIN" : "ZEON USER";
  return <div className="space-y-3 rounded-[18px] border border-white/10 bg-[#0b1017] p-5 text-sm text-slate-300"><div className="flex justify-between gap-4"><span>Имя</span><span className="font-semibold text-white">{user.name || "—"}</span></div><div className="flex justify-between gap-4"><span>Email</span><span className="font-semibold text-white">{user.email}</span></div><div className="flex justify-between gap-4"><span>Роль</span><span className="font-semibold text-violet-200">{role}</span></div><div className="flex justify-between gap-4"><span>Авторизация</span><span className="font-semibold text-white">Google</span></div><div className="flex justify-between gap-4"><span>Дата регистрации</span><span className="font-semibold text-white">{date(user.createdAt)}</span></div><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs text-slate-500">Тестовый Beta-доступ сохраняется отдельно от Google-сессии.</p><button type="button" onClick={onResetBeta} className="mt-3 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10">Сбросить Beta-доступ</button></div></div>;
}
