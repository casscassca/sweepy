"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, CalendarRange, House, LogOut, Settings, Users } from "lucide-react";
import { clearApiCache, loadJson } from "@/lib/api-cache";

const links = [
  { href: "/", label: "Today", icon: CalendarCheck },
  { href: "/upcoming", label: "Upcoming", icon: CalendarRange },
  { href: "/rooms", label: "Rooms", icon: House },
  { href: "/users", label: "People", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Nav() {
  const path = usePathname();
  const [me, setMe] = useState<{ name: string; color: string } | null>(null);

  useEffect(() => {
    void loadJson<{ user?: { name: string; color: string } }>("/api/auth/me", {}, (d) => setMe(d.user ?? null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearApiCache();
    window.location.href = "/login";
  }

  // The login page has no nav.
  if (path === "/login") return null;

  return (
    <>
      <nav
        aria-label="Main"
        style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
      >
        <div className="max-w-4xl mx-auto px-4 md:px-5 flex items-center gap-1 h-14">
          <Link href="/" className="flex items-center gap-2 mr-2 md:mr-5 shrink-0 min-h-11">
            <img src="/mascot.png" alt="" width={40} height={47} className="h-10 w-auto" />
            <span className="font-semibold text-base tracking-tight" style={{ color: "var(--text)" }}>
              Sweepy
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {links.map((l) => {
              const active = path === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: active ? "var(--accent-dim)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text2)",
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          {me && (
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text2)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: me.color }} />
                <span className="max-w-24 truncate md:max-w-none">{me.name}</span>
              </span>
              <button
                onClick={logout}
                type="button"
                aria-label="Log out"
                title="Log out"
                className="p-2.5 rounded-lg transition-colors min-h-11 min-w-11 flex items-center justify-center"
                style={{ color: "var(--text3)" }}
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </nav>

      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-40"
        style={{
          background: "var(--bg2)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="grid grid-cols-5">
          {links.map((l) => {
            const active = path === l.href;
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-0.5 min-h-14 text-[11px] font-medium"
                style={{ color: active ? "var(--accent)" : "var(--text3)" }}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
