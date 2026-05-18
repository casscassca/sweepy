import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Sweepy",
  description: "Home cleaning task manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <ThemeProvider>
          <Nav />
          <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
