"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogCase, Section } from "../types/admin";

const endpointForSection = (target: Section) =>
  target === "cases" || target === "drops" || target === "economy" || target === "tools"
    ? "/api/admin/cases"
    : target === "tester"
      ? "/api/tester/cases"
      : target === "audit" || target === "myAudit"
        ? "/api/admin/audit"
        : target === "transactions"
          ? "/api/admin/transactions"
          : null;

export function useAdminData(section: Section) {
  const [cases, setCases] = useState<CatalogCase[]>([]);
  const [records, setRecords] = useState<unknown[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState("");

  const loadSection = useCallback(async (target = section, silent = false) => {
    const endpoint = endpointForSection(target);
    if (!endpoint) return;
    if (!silent) setSectionLoading(true);
    setSectionError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
      const data = await response.json().catch(() => null);
      if (!response.ok) setSectionError(data?.error || "Не удалось загрузить раздел");
      else if (["cases", "drops", "economy", "tools", "tester"].includes(target)) setCases(data.cases ?? []);
      else setRecords(target === "audit" || target === "myAudit" ? data.logs ?? [] : data.transactions ?? []);
    } catch {
      setSectionError("Ошибка сети. Не удалось обновить данные.");
    } finally {
      if (!silent) setSectionLoading(false);
    }
  }, [section]);

  useEffect(() => {
    if (["dashboard", "create", "support", "zcoin", "roles", "console", "users", "force", "skinPrices"].includes(section)) return;
    void loadSection(section);
  }, [section, loadSection]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void loadSection(section, true);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [loadSection, section]);

  return { cases, records, sectionLoading, sectionError, setSectionError, loadSection };
}
