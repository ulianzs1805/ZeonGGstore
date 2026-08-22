"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminSection } from "../components/AdminSidebar";
import type { CatalogCase } from "../types/admin";

const endpointForSection = (target: AdminSection) => target === "cases" || target === "drops" || target === "economy" || target === "tools" ? "/api/admin/cases" : target === "tester" ? "/api/tester/cases" : target === "audit" || target === "myAudit" ? "/api/admin/audit" : target === "transactions" ? "/api/admin/transactions" : null;

export function useAdminSectionData(section: AdminSection) {
  const [cases, setCases] = useState<CatalogCase[]>([]);
  const [records, setRecords] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (target = section, silent = false) => {
    const endpoint = endpointForSection(target);
    if (!endpoint) return;
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
      const data = await response.json().catch(() => null);
      if (!response.ok) setError(data?.error || "Не удалось загрузить раздел");
      else if (["cases", "drops", "economy", "tools", "tester"].includes(target)) setCases(data.cases ?? []);
      else setRecords(target === "audit" || target === "myAudit" ? data.logs ?? [] : data.transactions ?? []);
    } catch { setError("Ошибка сети. Не удалось обновить данные."); }
    finally { if (!silent) setLoading(false); }
  }, [section]);

  useEffect(() => {
    if (["dashboard", "create", "support", "zcoin", "roles", "console", "users", "force", "skinPrices"].includes(section)) return;
    void load(section);
  }, [section, load]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(section, true); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
  }, [load, section]);

  return { cases, records, loading, error, setError, load };
}
