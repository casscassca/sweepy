"use client";
import { useEffect } from "react";
import { format } from "date-fns";
import { getJson } from "@/lib/api-cache";

export default function WarmCache() {
  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    void getJson("/api/users", []);
    void getJson("/api/auth/me", {});
    void getJson("/api/settings", null);
    void getJson("/api/rooms", []);
    void getJson(`/api/assignments?date=${today}`, []);
    void getJson(`/api/upcoming?from=${today}`, {});
  }, []);
  return null;
}
