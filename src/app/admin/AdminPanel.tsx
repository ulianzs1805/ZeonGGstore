"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
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
  const [step, setStep] = useState(1); const [name, setName] = useState(""); const [caseImage, setCaseImage] = useState(""); const [casePrice, setCasePrice] = useState(199); const [probabilityMode] = useState<"MANUAL" | "DYNAMIC">("MANUAL"); const [drops, setDrops] = useState<DropDraft[]>([newDrop()]); const [message, setMessage] = useState(""); const [createdCase, setCreatedCase] = useState<{ slug: string; name: string; drops: number } | null>(null); const [submitting, setSubmitting] = useState(false); const [section, setSection] = useState<Section>("dashboard"); const [cases, setCases] = useState<CatalogCase[]>([]); const [records, setRecords] = useState<unknown[]>([]); const [sectionLoading, setSectionLoading] = useState(false); const [sectionError, setSectionError] = useState(""); const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const totalProbability = drops.reduce((sum, drop) => sum + (Number.isFinite(drop.probability) ? drop.probability : 0), 0);
  const validDraft = Boolean(name.trim() && caseImage && drops.length > 0 && drops.every((drop) => drop.name.trim() && drop.image && Number.isInteger(drop.price) && drop.price > 0 && (role === "ADMIN" || drop.probability > 0)) && (role === "ADMIN" || Math.abs(totalProbability - 100) < 0.001));
  const updateDrop = (index: number, patch: Partial<DropDraft>) => setDrops((current) => current.map((drop, dropIndex) => dropIndex === index ? { ...drop, ...patch } : drop));
  const next = () => { setMessage(""); if (!name.trim() || !caseImage) { setMessage("Загрузите изображение и укажите название кейса."); return; } setStep(2); };
  const createCase = async () => { setSubmitting(true); setMessage(""); try { const response = await fetch("/api/admin/cases", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, image: caseImage, price: casePrice, probabilityMode, drops }) }); const data = await response.json().catch(() => null); if (!response.ok) setMessage(data?.error || "Не удалось создать кейс."); else { setCreatedCase({ slug: data.case.slug, name: data.case.name, drops: data.case.drops.length }); setMessage("Кейс успешно создан и записан в audit log."); } } catch { setMessage("Ошибка сети. Проверьте подключение и попробуйте ещё раз."); } finally { setSubmitting(false); } };
  const endpointForSection = useCallback((target: Section) => target === "cases" || target === "drops" || target === "economy" || target === "tools" ? "/api/admin/cases" : target === "tester" ? "/api/tester/cases" : target === "audit" || target === "myAudit" ? "/api/admin/audit" : target === "transactions" ? "/api/admin/transactions" : null, []);
  const loadSection = useCallback(async (target = section, silent = false) => { const endpoint = endpointForSection(target); if (!endpoint) return; if (!silent) setSectionLoading(true); setSectionError(""); try { const response = await fetch(endpoint, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }); const data = await response.json().catch(() => null); if (!response.ok) setSectionError(data?.error || "Не удалось загрузить раздел"); else if (target === "cases" || target === "drops" || target === "economy" || target === "tools" || target === "tester") setCases(data.cases ?? []); else setRecords(target === "audit" || target === "myAudit" ? data.logs ?? [] : data.transactions ?? []); } catch { setSectionError("Ошибка сети. Не удалось обновить данные."); } finally { if (!silent) setSectionLoading(false); } }, [endpointForSection, section]);
  useEffect(() => { if (["dashboard", "create", "support", "zcoin", "roles", "console", "users", "force", "skinPrices"].includes(section)) return; void loadSection(section); }, [section, loadSection]);
  useEffect(() => { const refresh = () => { if (document.visibilityState === "visible") void loadSection(section, true); }; document.addEventListener("visibilitychange", refresh); window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); }; }, [loadSection, section]);
  useEffect(() => { setMobileNavOpen(false); }, [section]);
  const sections: Array<{ id: Section; label: string; visible: boolean }> = [
    { id: "dashboard", label: "Обзор", visible: true }, { id: "create", label: "Создать кейс", visible: true }, { id: "cases", label: "Управление кейсами", visible: true }, { id: "drops", label: "Дропы", visible: true }, { id: "users", label: "Пользователи", visible: true }, { id: "roles", label: "Выдать роль", visible: role === "DEV" || role === "NPN1_DEV" }, { id: "support", label: "Поддержка", visible: true }, { id: "myAudit", label: "Мои действия", visible: true }, { id: "economy", label: "Экономика", visible: role !== "ADMIN" }, { id: "transactions", label: "Транзакции", visible: role !== "ADMIN" }, { id: "zcoin", label: "Z-Coin", visible: role !== "ADMIN" }, { id: "console", label: "Dev Console", visible: role !== "ADMIN" }, { id: "audit", label: "Audit Logs", visible: role !== "ADMIN" }, { id: "force", label: "Force Drop / Test Drop", visible: role === "NPN1_DEV" }, { id: "skinPrices", label: "Стоимость скинов", visible: role === "DEV" || role === "NPN1_DEV" }, { id: "tester", label: "Tester Tools", visible: role === "TESTER" || role === "DEV" || role === "NPN1_DEV" }, { id: "tools", label: "Developer Tools", visible: role !== "ADMIN" },
  ];
  const visibleSections = sections.filter((item) => item.visible); const activeLabel = visibleSections.find((item) => item.id === section)?.label ?? "Админка";
  const toggleCase = async (item: CatalogCase) => { const endpoint = section === "tester" ? "/api/tester/cases" : "/api/admin/cases"; const response = await fetch(endpoint, { method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: item.id, isActive: !item.isActive }) }); const data = await response.json().catch(() => null); if (!response.ok) setSectionError(data?.error || "Не удалось изменить статус кейса"); else await loadSection(section, true); };
