"use client";

import { useState } from "react";

type Entry = { command: string; output: string; success: boolean };
const whitelist = ["role grant USER_ID ADMIN", "role grant USER_ID DEV", "zcoin grant USER_ID AMOUNT", "zcoin revoke USER_ID AMOUNT", "case list", "economy check", "system health"];

export default function DevConsolePanel() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const value = command.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/dev-console", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: value }) });
      const data = await response.json().catch(() => null);
      setHistory((current) => [...current, { command: value, output: response.ok ? JSON.stringify(data, null, 2) : data?.error || "Команда отклонена", success: response.ok }].slice(-20));
      setCommand("");
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-4"><div><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Dev Console</h2><p className="mt-2 text-sm text-slate-400">Whitelist-only console. Shell, SQL, eval и произвольный код запрещены. DEV назначается только отсюда и только NPN1_DEV.</p></div><button type="button" onClick={() => setHistory([])} disabled={!history.length} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Очистить</button></div><div className="mt-4 flex flex-wrap gap-2">{whitelist.map((item) => <button key={item} type="button" onClick={() => setCommand(item)} className="rounded-full border border-emerald-300/20 px-3 py-1.5 font-mono text-[0.65rem] text-emerald-200 hover:bg-emerald-400/10">{item}</button>)}</div></div><div className="rounded-2xl border border-emerald-300/20 bg-[#030706] p-4 font-mono text-xs"><div className="max-h-[420px] min-h-40 space-y-4 overflow-y-auto">{!history.length && <p className="text-emerald-300/70">Whitelist: выберите команду или введите её ниже.</p>}{history.map((entry, index) => <div key={`${entry.command}-${index}`}><p className="break-all text-slate-300"><span className="text-emerald-400">&gt;</span> {entry.command}</p><pre className={`mt-1 whitespace-pre-wrap break-words ${entry.success ? "text-emerald-300" : "text-red-300"}`}>{entry.output}</pre></div>)}</div><div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row"><div className="flex min-w-0 flex-1 items-center gap-2"><span className="text-emerald-400">&gt;</span><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} placeholder="role grant USER_ID DEV" className="min-w-0 flex-1 bg-transparent text-white outline-none" /></div><button type="button" disabled={busy || !command.trim()} onClick={() => void run()} className="rounded-lg bg-emerald-500 px-3 py-2 font-bold text-black disabled:opacity-40">{busy ? "Выполняем..." : "Выполнить"}</button></div></div></div>;
}