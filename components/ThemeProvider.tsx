"use client";
import { useEffect } from "react";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  return <>{children}</>;
}
