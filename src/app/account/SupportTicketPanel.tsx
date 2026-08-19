"use client";

import { useState, type FormEvent } from "react";

type Ticket = { id: string; subject: string; description: string; status: string; createdAt: string };
type Message = { id: string; body: string; createdAt: string; author: { name: string | null; email: string; role: string } };

function date(value: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }

export default function SupportTicketPanel({ tickets, onRefresh }: { tickets: Ticket[]; onRefresh: () => Promise<void> }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<{ ticket: Ticket; messages: Message[] } | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const createTicket = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, description }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error || "Не удалось создать обращение");
    else { setSubject(""); setDescription(""); await onRefresh(); }
    setBusy(false);
  };

  const openTicket = async (ticketId: string) => {
    const response = await fetch(`/api/support/${ticketId}/messages`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setSelected({ ticket: data.ticket, messages: data.ticket.messages });
  };

  const sendReply = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || !reply.trim()) return;
    setBusy(true); const response = await fetch(`/api/support/${selected.ticket.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }) });
    if (response.ok) { setReply(""); await openTicket(selected.ticket.id); await onRefresh(); } else { const data = await response.json().catch(() => null); setError(data?.error || "Не удалось отправить сообщение"); }
    setBusy(false);
  };

  return <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><div><form onSubmit={createTicket} className="space-y-3 rounded-[18px] border border-white/10 bg-[#0b1017] p-5"><select value={subject} onChange={(event) => setSubject(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-[#080d15] px-3 py-2.5 text-sm text-white"><option value="">Выберите тему</option><option>Предмет не появился</option><option>Проблема с открытием кейса</option><option>Проблема с продажей</option><option>Проблема с балансом</option><option>Проблема с транзакцией</option><option>Другое</option></select><textarea value={description} onChange={(event) => setDescription(event.target.value)} required rows={5} placeholder="Описание проблемы" className="w-full resize-none rounded-xl border border-white/10 bg-[#080d15] px-3 py-2.5 text-sm text-white placeholder:text-slate-500" /><button type="submit" disabled={busy} className="rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 disabled:opacity-50">{busy ? "Отправка..." : "Создать обращение"}</button></form>{error && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}<div className="mt-5 space-y-3">{tickets.length ? tickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => void openTicket(ticket.id)} className="block w-full rounded-xl border border-white/10 bg-[#0b1017] p-4 text-left hover:border-violet-300/40"><div className="flex justify-between gap-3"><span className="font-semibold text-white">{ticket.subject}</span><span className="text-xs text-violet-200">{ticket.status}</span></div><p className="mt-2 text-sm text-slate-400">{date(ticket.createdAt)}</p></button>) : <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-400">Обращений пока нет</div>}</div></div><section className="rounded-[18px] border border-white/10 bg-[#0b1017] p-5">{selected ? <><div className="border-b border-white/10 pb-4"><h2 className="font-black text-white">{selected.ticket.subject}</h2><p className="mt-2 text-sm text-slate-400">{selected.ticket.description}</p></div><div className="max-h-80 space-y-3 overflow-y-auto py-4">{selected.messages.length ? selected.messages.map((message) => <div key={message.id} className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-xs font-bold text-violet-200">{message.author.name || message.author.email}</p><p className="mt-1 text-sm text-slate-200">{message.body}</p><p className="mt-2 text-[0.68rem] text-slate-500">{date(message.createdAt)}</p></div>) : <p className="text-sm text-slate-500">Сообщений пока нет.</p>}</div><form onSubmit={sendReply} className="flex gap-2 border-t border-white/10 pt-4"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Ответить" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" /><button type="submit" disabled={busy || !reply.trim()} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold disabled:opacity-40">Отправить</button></form></> : <div className="flex min-h-64 items-center justify-center text-center text-sm text-slate-500">Выберите обращение, чтобы открыть переписку.</div>}</section></div>;
}