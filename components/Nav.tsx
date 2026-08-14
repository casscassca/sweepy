"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import DogIcon from "./DogIcon";

const links = [
  { href: "/", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/rooms", label: "Rooms" },
  { href: "/users", label: "People" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();
  const [me, setMe] = useState<{ name: string; color: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, [path]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // The login page has no nav.
  if (path === "/login") return null;

  return (
    <nav style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
      <div className="max-w-4xl mx-auto px-5 flex items-center gap-1 h-14">
        <Link href="/" className="flex items-center gap-2.5 mr-5 shrink-0">
          <DogIcon size={30} />
          <span className="font-semibold text-base tracking-tight" style={{ color: "var(--text)" }}>
            Sweepy
          </span>
        </Link>

        <div className="flex items-center gap-0.5">
          {links.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
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
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text2)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: me.color }} />
              {me.name}
            </span>
            <button
              onClick={logout}
              title="Log out"
              className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--text3)" }}
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
