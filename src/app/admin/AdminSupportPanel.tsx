"use client";

import { useEffect, useState } from "react";

type Ticket = { id: string; subject: string; description: string; status: string; user: { email: string; name: string | null }; messages: Array<{ id: string; body: string; createdAt: string }> };

export default function AdminSupportPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = async () => {
      setLoading(true);
      setError("");
      const response = await fetch("/api/admin/support", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok) setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
      else setError(data?.error || "Не удалось загрузить поддержку");
      setLoading(false);
    };
  useEffect(() => { void load(); }, []);
  const updateStatus = async (ticketId: string, status: string) => { setBusy(true); const response = await fetch("/api/admin/support", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, status }) }); if (!response.ok) setError("Не удалось обновить статус обращения"); await load(); setBusy(false); };
  const sendReply = async (ticketId: string) => { if (!reply.trim()) return; setBusy(true); const response = await fetch(`/api/support/${ticketId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) }); if (!response.ok) setError("Не удалось отправить ответ"); else setReply(""); await load(); setBusy(false); };
  const ticket = tickets.find((item) => item.id === selected);
  return <section className="mt-5 rounded-3xl border border-violet-300/15 bg-white/[0.035] p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-black">Support tickets</h2><span className="text-xs text-slate-400">{tickets.length} обращений</span></div>{error && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => void load()} className="rounded-lg border border-red-300/30 px-3 py-2 font-bold">Повторить</button></div>}{loading && <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">Загрузка...</p>}{!loading && <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]"><div className="space-y-2">{tickets.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item.id)} className={`w-full rounded-xl border p-3 text-left ${item.id === selected ? "border-violet-300/50 bg-violet-400/10" : "border-white/10 bg-black/15"}`}><p className="truncate font-bold text-white">{item.subject}</p><p className="mt-1 truncate text-xs text-slate-400">{item.user.email} · {item.status}</p></button>)}{!tickets.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Новых обращений нет.</p>}</div><div>{ticket ? <><p className="font-bold text-white">{ticket.subject}</p><p className="mt-2 break-words text-sm text-slate-300">{ticket.description}</p><select disabled={busy} value={ticket.status} onChange={(event) => void updateStatus(ticket.id, event.target.value)} className="mt-3 max-w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white"><option>OPEN</option><option>IN_PROGRESS</option><option>CLOSED</option></select><div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{ticket.messages.length ? ticket.messages.map((message) => <p key={message.id} className="break-words rounded-lg bg-black/20 p-2 text-sm text-slate-300">{message.body}</p>) : <p className="text-sm text-slate-500">Ответов пока нет.</p>}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Ответ пользователю" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" /><button type="button" disabled={busy || !reply.trim()} onClick={() => void sendReply(ticket.id)} className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold disabled:opacity-40">Ответить</button></div></> : <p className="text-sm text-slate-500">Выберите обращение.</p>}</div></div>}</section>;
}