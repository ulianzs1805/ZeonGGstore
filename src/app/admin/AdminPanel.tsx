"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import ImageUploadField from "./ImageUploadField";
import AdminSupportPanel from "./AdminSupportPanel";
import ZCoinPanel from "./ZCoinPanel";
import RoleManagementPanel from "./RoleManagementPanel";
import DevConsolePanel from "./DevConsolePanel";
import UsersPanel from "./UsersPanel";
import ForceDropPanel from "./ForceDropPanel";
import DashboardPanel from "./DashboardPanel";
import SkinPricePanel from "./SkinPricePanel";

type Role = "ADMIN" | "DEV" | "NPN1_DEV" | "TESTER";
type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic" | "ARCANE" | "NAMELESS";
type DropDraft = { name: string; rarity: Rarity; image: string; price: number; probability: number };
type Section = "dashboard" | "create" | "cases" | "drops" | "support" | "users" | "roles" | "myAudit" | "audit" | "economy" | "transactions" | "zcoin" | "console" | "force" | "tools" | "tester" | "skinPrices";
type CatalogCase = { id: string; slug: string; name: string; image: string; price: number; isActive: boolean; probabilityMode: "MANUAL" | "DYNAMIC"; createdAt: string; createdById: string; drops: Array<{ id: string; name: string; rarity: string; price: number; probability: number; image: string }> };
const rarities: Rarity[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "ARCANE", "NAMELESS"];
const newDrop = (): DropDraft => ({ name: "", rarity: "Rare", image: "", price: 100, probability: 0 });

export default function AdminPanel({ role, email, staffId }: { role: Role; email: string; staffId: string | null }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [caseImage, setCaseImage] = useState("");
  const [casePrice, setCasePrice] = useState(199);
  const [probabilityMode, setProbabilityMode] = useState<"MANUAL" | "DYNAMIC">("MANUAL");
  const [probabilityPreview, setProbabilityPreview] = useState<Array<{ name: string; rarity: string; price: number; baseWeight: number; calculatedProbability: number }>>([]);
  const [previewError, setPreviewError] = useState("");
  const [drops, setDrops] = useState<DropDraft[]>([newDrop()]);
  const [message, setMessage] = useState("");
  const [createdCase, setCreatedCase] = useState<{ slug: string; name: string; drops: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [section, setSection] = useState<Section>("dashboard");
  const [cases, setCases] = useState<CatalogCase[]>([]);
  const [records, setRecords] = useState<unknown[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const canEditEconomy = role !== "ADMIN";
  const totalProbability = drops.reduce((sum, drop) => sum + (Number.isFinite(drop.probability) ? drop.probability : 0), 0);
  const validDraft = Boolean(name.trim() && caseImage && drops.length > 0 && drops.every((drop) => drop.name.trim() && drop.image && Number.isInteger(drop.price) && drop.price > 0 && (role === "ADMIN" || drop.probability > 0)) && (role === "ADMIN" || Math.abs(totalProbability - 100) < 0.001));

  const updateDrop = (index: number, patch: Partial<DropDraft>) => setDrops((current) => current.map((drop, dropIndex) => dropIndex === index ? { ...drop, ...patch } : drop));
  const next = () => { setMessage(""); if (!name.trim() || !caseImage) { setMessage("Загрузите изображение и укажите название кейса."); return; } setStep(2); };
  const createCase = async () => {
    setSubmitting(true);
    setMessage("");
    const response = await fetch("/api/admin/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, image: caseImage, price: casePrice, probabilityMode, drops }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setMessage(data?.error || "Не удалось создать кейс.");
    else { setCreatedCase({ slug: data.case.slug, name: data.case.name, drops: data.case.drops.length }); setMessage("Кейс успешно создан и записан в audit log."); }
    setSubmitting(false);
  };

  useEffect(() => {
    if (section !== "create" || step !== 2) return;
    const preview = async () => {
      const response = await fetch("/api/admin/cases/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ probabilityMode, drops }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setPreviewError(data?.error || "Заполните Drops для расчёта."); setProbabilityPreview([]); return; }
      setPreviewError("");
      setProbabilityPreview(data.drops ?? []);
    };
    void preview();
  }, [section, step, probabilityMode, drops]);

  const toggleCase = async (item: CatalogCase) => {
    const endpoint = section === "tester" ? "/api/tester/cases" : "/api/admin/cases";
    const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: item.id, isActive: !item.isActive }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setSectionError(data?.error || "Не удалось изменить статус кейса");
    else setCases((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isActive: !item.isActive } : candidate));
  };

  const toggleProbabilityMode = async (item: CatalogCase) => {
    const probabilityMode = item.probabilityMode === "DYNAMIC" ? "MANUAL" : "DYNAMIC";
    const response = await fetch("/api/admin/cases", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: item.id, probabilityMode }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setSectionError(data?.error || "Не удалось изменить режим вероятностей");
    else setCases((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, probabilityMode } : candidate));
  };

  useEffect(() => {
    if (section === "dashboard" || section === "create" || section === "support" || section === "zcoin" || section === "roles" || section === "console" || section === "users" || section === "force" || section === "skinPrices") return;
    const loadSection = async () => {
      setSectionLoading(true);
      setSectionError("");
      const endpoint = section === "cases" || section === "drops" || section === "economy" || section === "tools" ? "/api/admin/cases" : section === "tester" ? "/api/tester/cases" : section === "audit" || section === "myAudit" ? "/api/admin/audit" : section === "transactions" ? "/api/admin/transactions" : null;
      if (!endpoint) { setSectionLoading(false); return; }
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) setSectionError(data?.error || "Не удалось загрузить раздел");
      else if (section === "cases" || section === "drops" || section === "economy" || section === "tools") setCases(data.cases ?? []);
      else if (section === "tester") setCases(data.cases ?? []);
      else setRecords(section === "audit" || section === "myAudit" ? data.logs ?? [] : data.transactions ?? []);
      setSectionLoading(false);
    };
    void loadSection();
  }, [section]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [section]);

  const sections: Array<{ id: Section; label: string; visible: boolean }> = [
    { id: "dashboard", label: "Обзор", visible: true },
    { id: "create", label: "Создать кейс", visible: true },
    { id: "cases", label: "Управление кейсами", visible: true },
    { id: "drops", label: "Дропы", visible: true },
    { id: "users", label: "Пользователи", visible: true },
    { id: "roles", label: "Выдать роль", visible: role === "DEV" || role === "NPN1_DEV" },
    { id: "support", label: "Поддержка", visible: true },
    { id: "myAudit", label: "Мои действия", visible: true },
    { id: "economy", label: "Экономика", visible: role !== "ADMIN" },
    { id: "transactions", label: "Транзакции", visible: role !== "ADMIN" },
    { id: "zcoin", label: "Z-Coin", visible: role !== "ADMIN" },
    { id: "console", label: "Dev Console", visible: role !== "ADMIN" },
    { id: "audit", label: "Audit Logs", visible: role !== "ADMIN" },
    { id: "force", label: "Force Drop / Test Drop", visible: role === "NPN1_DEV" },
    { id: "skinPrices", label: "Стоимость скинов", visible: role === "DEV" || role === "NPN1_DEV" },
    { id: "tester", label: "Tester Tools", visible: role === "TESTER" || role === "DEV" || role === "NPN1_DEV" },
    { id: "tools", label: "Developer Tools", visible: role !== "ADMIN" },
  ];

  const renderDataSection = () => {
    if (sectionLoading) return <p className="rounded-xl border border-white/10 p-5 text-sm text-slate-400">Загрузка...</p>;
    if (sectionError) return <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-200">{sectionError}</p>;
    if (section === "cases" || section === "tester") return cases.length ? <div className="grid gap-4 md:grid-cols-2">{cases.map((item) => { const probabilityTotal = item.drops.reduce((sum, drop) => sum + drop.probability, 0); const probabilityValid = Math.abs(probabilityTotal - 100) < 0.001; return <article key={item.id} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="relative h-32"><Image src={item.image} alt={item.name} fill className="object-contain" unoptimized /></div><div className="mt-3 flex items-start justify-between gap-3"><h3 className="font-black">{item.name}</h3><span className={`shrink-0 rounded-full border px-2 py-1 text-[0.65rem] font-bold ${item.isActive ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-slate-300/20 bg-slate-400/10 text-slate-300"}`}>{item.isActive ? "ACTIVE" : "INACTIVE"}</span></div><p className="mt-2 text-xs text-slate-400">{item.price} Z · {item.drops.length} drops · Created {new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" }).format(new Date(item.createdAt))}</p><p className={`mt-2 text-xs font-bold ${probabilityValid ? "text-emerald-300" : "text-amber-300"}`}>{probabilityValid ? "✓ Probability valid" : "⚠ Некорректная сумма"} · {probabilityTotal}%</p><p className="mt-1 break-all text-[0.65rem] text-slate-500">{item.slug} · {item.id}</p><button type="button" onClick={() => void toggleCase(item)} className="mt-3 rounded-lg border border-violet-300/30 px-3 py-2 text-xs font-bold text-violet-100">{item.isActive ? "Деактивировать" : "Активировать"}</button></article>; })}</div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">Кейсы не найдены.</p>;
    if (section === "drops") return cases.length ? <div className="space-y-5">{cases.map((item) => <section key={item.id} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3"><div><h3 className="font-black text-white">{item.name}</h3><p className="mt-1 text-xs text-slate-400">{item.isActive ? "ACTIVE" : "INACTIVE"} · {item.drops.length} drops</p></div><span className="text-xs text-slate-500">{item.slug}</span></div><div className="mt-3 space-y-2">{item.drops.length ? item.drops.map((drop) => <article key={drop.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="relative h-14 w-14 shrink-0"><Image src={drop.image} alt={drop.name} fill className="object-contain" unoptimized /></div><div className="min-w-0"><p className="truncate font-bold text-white">{drop.name}</p><p className="mt-1 text-xs text-slate-400">{drop.rarity} · {drop.price} Z · {drop.probability}%</p></div></article>) : <p className="text-sm text-slate-500">В этом кейсе пока нет Drops.</p>}</div></section>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">Кейсы не найдены.</p>;
    if (section === "economy") return <div className="grid gap-4 sm:grid-cols-3">{[{ label: "Кейсов", value: cases.length }, { label: "Дропов", value: cases.reduce((sum, item) => sum + item.drops.length, 0) }, { label: "Некорректных probability", value: cases.filter((item) => Math.abs(item.drops.reduce((sum, drop) => sum + drop.probability, 0) - 100) > 0.001).length }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-black/15 p-5"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</p><p className="mt-3 text-3xl font-black text-violet-200">{item.value}</p></div>)}</div>;
    if (section === "tools") return <div className="space-y-3 text-sm text-slate-300"><p className="rounded-xl border border-white/10 p-4">DB-backed cases: {cases.length ? "OK" : "EMPTY"}</p><p className="rounded-xl border border-white/10 p-4">EconomyGuard: ACTIVE</p><p className="rounded-xl border border-white/10 p-4">NPN identity: {role === "NPN1_DEV" ? "ACTIVE" : "NOT AVAILABLE"}</p></div>;
    if (section === "force") return <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-5 text-sm text-amber-100">Force Drop доступен только через отдельную подтверждённую NPN1 операцию. Выберите пользователя, кейс, Drop и причину перед запуском.</div>;
    if (section === "audit" || section === "myAudit" || section === "transactions") return <div className="space-y-3">{records.map((record, index) => <pre key={index} className="overflow-x-auto rounded-xl border border-white/10 bg-black/15 p-3 text-xs text-slate-300">{JSON.stringify(record, null, 2)}</pre>)}</div>;
    return null;
  };

  return <main className="min-h-screen overflow-x-hidden bg-[#06040d] px-4 py-5 text-white sm:px-8 sm:py-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-violet-400/20 pb-5 sm:mb-8 sm:items-end sm:pb-6"><div><div className="flex items-center gap-3"><button type="button" onClick={() => setMobileNavOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl text-slate-200 lg:hidden" aria-label="Открыть навигацию">☰</button><div><p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300">ZEON CONTROL</p><h1 className="mt-2 text-2xl font-black sm:text-4xl">{role === "ADMIN" ? "Admin Panel" : role === "DEV" ? "Dev Panel" : "Developer Console"}</h1></div></div><p className="mt-2 break-all text-sm text-slate-400">{email}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Staff ID: {staffId ?? "—"}</p></div><Link href="/account" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-violet-300/50 hover:text-white sm:px-4">Вернуться в профиль</Link></header>
    <div className="mb-5 lg:hidden">
      <label className="sr-only" htmlFor="admin-section-mobile">Раздел панели</label>
      <select id="admin-section-mobile" value={section} onChange={(event) => setSection(event.target.value as Section)} className="w-full rounded-xl border border-violet-300/25 bg-[#0b0715] px-4 py-3 text-sm font-bold text-white outline-none focus:border-violet-300/60">
        {sections.filter((item) => item.visible).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
    {mobileNavOpen && <button type="button" aria-label="Закрыть навигацию" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-black/70 lg:hidden" />}
    <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
      <div className={`fixed inset-y-0 left-0 z-50 max-h-screen w-[min(84vw,320px)] transform overflow-y-auto overscroll-contain border-r border-violet-300/20 bg-[#0b0715] p-4 shadow-2xl transition-transform lg:static lg:z-auto lg:max-h-none lg:w-auto lg:translate-x-0 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="mb-4 flex items-center justify-between lg:hidden"><span className="font-black text-violet-100">Навигация</span><button type="button" onClick={() => setMobileNavOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300" aria-label="Закрыть навигацию">×</button></div><nav className="space-y-2 pb-6">{sections.filter((item) => item.visible).map((item) => <button key={`${item.id}-${item.label}`} type="button" onClick={() => setSection(item.id)} className={`w-full rounded-2xl border p-3 text-left text-sm font-semibold transition sm:p-4 ${section === item.id ? "border-violet-300/50 bg-violet-400/10 text-white shadow-[0_0_24px_rgba(124,58,237,0.2)]" : "border-violet-300/15 bg-white/[0.04] text-slate-300 hover:border-violet-300/30"}`}>{item.label}</button>)}</nav></div>
      <section className="rounded-3xl border border-violet-300/20 bg-white/[0.045] p-5 shadow-[0_0_45px_rgba(124,58,237,0.12)] sm:p-7">
        {section === "dashboard" && <DashboardPanel />}
        {section === "cases" && (role === "DEV" || role === "NPN1_DEV") && cases.length > 0 && <div className="mb-5 rounded-2xl border border-violet-300/20 bg-violet-400/5 p-4"><p className="mb-3 text-sm font-black text-violet-100">Режим вероятностей Case</p><div className="grid gap-2 sm:grid-cols-2">{cases.map((item) => <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{item.name}</p><p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">{item.probabilityMode} · rarity + price только в DYNAMIC</p></div><button type="button" onClick={() => void toggleProbabilityMode(item)} className="shrink-0 rounded-lg border border-violet-300/30 px-3 py-2 text-xs font-black text-violet-100">{item.probabilityMode === "DYNAMIC" ? "В Manual" : "В Dynamic"}</button></div>)}</div></div>}
        {section === "create" && !createdCase && <div className="mb-5 rounded-2xl border border-violet-300/20 bg-violet-400/5 p-4"><label className="block text-sm font-bold text-slate-200">Режим вероятностей<select value={probabilityMode} onChange={(event) => setProbabilityMode(event.target.value as "MANUAL" | "DYNAMIC")} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none focus:border-violet-300/60"><option value="MANUAL">Manual probability</option><option value="DYNAMIC">Dynamic: rarity + price</option></select></label><p className="mt-2 text-xs text-slate-500">Dynamic mode рассчитывается сервером по rarity и цене каждого Drop.</p></div>}
        {section === "create" && !createdCase && step === 2 && probabilityMode === "DYNAMIC" && <div className="mb-5 overflow-x-auto rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-4"><p className="mb-3 text-sm font-black text-emerald-100">Preview: Rarity + Price → Final Probability</p>{previewError ? <p className="text-xs text-amber-200">{previewError}</p> : <table className="w-full min-w-[560px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">Drop</th><th className="pb-2">Rarity</th><th className="pb-2">Price</th><th className="pb-2">Base Weight</th><th className="pb-2">Calculated Probability</th></tr></thead><tbody>{probabilityPreview.map((item, index) => <tr key={`${item.name}-${index}`} className="border-t border-white/5"><td className="py-2 font-bold text-white">{item.name || `Drop #${index + 1}`}</td><td className="py-2 text-slate-300">{item.rarity}</td><td className="py-2 text-slate-300">{item.price} Z</td><td className="py-2 text-slate-300">{item.baseWeight.toFixed(2)}%</td><td className="py-2 font-black text-emerald-300">{item.calculatedProbability.toFixed(4)}%</td></tr>)}</tbody></table>}</div>}
        {section !== "dashboard" && section !== "create" && section !== "support" && section !== "zcoin" && section !== "roles" && section !== "console" && section !== "users" && section !== "force" && section !== "skinPrices" && <><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-300">ZEON CONSOLE</p><h2 className="mt-2 text-2xl font-black">{sections.find((item) => item.id === section)?.label}</h2></div>{renderDataSection()}</>}
        {section === "support" && <AdminSupportPanel />}
        {section === "zcoin" && <ZCoinPanel />}
        {section === "users" && <UsersPanel canAdjustBalance={canEditEconomy} />}
        {section === "roles" && (role === "DEV" || role === "NPN1_DEV") && <RoleManagementPanel role={role as "DEV" | "NPN1_DEV"} />}
        {section === "console" && <DevConsolePanel />}
        {section === "force" && role === "NPN1_DEV" && <ForceDropPanel />}
        {section === "skinPrices" && (role === "DEV" || role === "NPN1_DEV") && <><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-300">ECONOMY CONTROL</p><h2 className="mt-2 text-2xl font-black">Стоимость скинов</h2><p className="mt-2 text-sm text-slate-400">Изменение цен с ограничениями роли и серверной проверкой.</p><SkinPricePanel /></>}
        {section === "create" && !createdCase && <div className="mt-2"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-300">CASE BUILDER</p><h2 className="mt-2 text-2xl font-black">Создать кейс</h2><p className="mt-2 text-sm text-slate-400">Сначала загрузи обложку и название, затем добавь Drops и вероятности.</p></div><div className="space-y-5"><ImageUploadField value={caseImage} onChange={setCaseImage} label="Обложка кейса" /><label className="block text-sm font-bold text-slate-200">Название кейса<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none focus:border-violet-300/50" placeholder="Например, Furious" /></label><label className="block text-sm font-bold text-slate-200">Цена кейса<input type="number" min="1" value={casePrice} onChange={(event) => setCasePrice(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none focus:border-violet-300/50" /></label><div className="space-y-3">{drops.map((drop, index) => <article key={index} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold">Название Drop<input value={drop.name} onChange={(event) => updateDrop(index, { name: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" /></label><label className="block text-sm font-bold">Rarity<select value={drop.rarity} onChange={(event) => updateDrop(index, { rarity: event.target.value as Rarity })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3">{rarities.map((rarity) => <option key={rarity}>{rarity}</option>)}</select></label><label className="block text-sm font-bold">Цена<input type="number" min="1" value={drop.price} onChange={(event) => updateDrop(index, { price: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" /></label><label className="block text-sm font-bold">Вероятность %<input type="number" min="0" max="100" step="0.01" value={drop.probability} onChange={(event) => updateDrop(index, { probability: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3" /></label><ImageUploadField value={drop.image} onChange={(value) => updateDrop(index, { image: value })} label="PNG Drop" /></div></article>)}<button type="button" onClick={() => setDrops((current) => [...current, newDrop()])} className="rounded-xl border border-violet-300/20 px-4 py-2 text-sm font-bold text-violet-100">+ Добавить Drop</button></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-sm text-slate-300">Всего probability: <span className={Math.abs(totalProbability - 100) < 0.001 ? "text-emerald-300" : "text-amber-300"}>{totalProbability.toFixed(2)}%</span></p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={next} disabled={!name.trim() || !caseImage} className="rounded-xl bg-violet-500 px-5 py-3 font-black text-white disabled:opacity-50">Далее</button>{step === 2 && <button type="button" onClick={() => void createCase()} disabled={!validDraft || submitting} className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-black disabled:opacity-40">{submitting ? "Создаём…" : "Создать кейс"}</button>}</div>{message && <p className="mt-3 text-sm text-violet-200">{message}</p>}</div></div></div>}
        {createdCase && section === "create" && <div className="space-y-5"><p className="text-sm text-emerald-200">{message}</p><div className="rounded-2xl border border-white/10 p-5"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Создан</p><h2 className="mt-2 text-2xl font-black">{createdCase.name}</h2><p className="mt-2 text-sm text-slate-400">Slug: {createdCase.slug} · Drops: {createdCase.drops}</p></div></div>}
      </section>
    </div>
  </div></main>;
}
