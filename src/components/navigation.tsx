"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUDIENCE_NAV, STUDIO_NAV, isNavCurrent } from "@/lib/navigation";
import { useSession } from "./session";
import { Button } from "./ui";

export function AppHeader() {
  const pathname = usePathname();
  const { user, loading, signOut } = useSession();

  return (
    <header className="app-header">
      <Link href="/" className="brand" aria-label="UNIVOX home">
        <span className="brand-mark" aria-hidden="true" />
        UNIVOX
      </Link>
      <nav className="desktop-nav" aria-label="Primary">
        {AUDIENCE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={isNavCurrent(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        {loading ? (
          <span className="lede">Checking session</span>
        ) : user ? (
          <>
            <Link className="nav-link" href="/studio/settings">
              {user.profile?.handle ? `@${user.profile.handle}` : user.user.displayName}
            </Link>
            <Button type="button" variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <Link className="nav-link" href="/login">
              Sign in
            </Link>
            <Link className="btn" href="/register">
              Join
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Primary mobile">
      {AUDIENCE_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="bottom-link"
            aria-current={isNavCurrent(pathname, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function StudioNav() {
  const pathname = usePathname();
  return (
    <nav className="studio-nav" aria-label="Creator Studio">
      {STUDIO_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="studio-link"
            aria-current={isNavCurrent(pathname, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
