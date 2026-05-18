"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
      </div>
    </nav>
  );
}
