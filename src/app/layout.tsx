import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppHeader, BottomNav } from "@/components/navigation";
import { SessionProvider } from "@/components/session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "UNIVOX",
    template: "%s · UNIVOX",
  },
  description: "Creator operating system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SessionProvider>
          <div className="app-shell">
            <AppHeader />
            {children}
            <BottomNav />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
