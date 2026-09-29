export const AUDIENCE_NAV = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/communities", label: "Communities" },
  { href: "/live", label: "Live" },
  { href: "/messages", label: "Messages" },
  { href: "/studio", label: "Creator Studio" },
] as const;

export const STUDIO_NAV = [
  { href: "/studio", label: "Overview" },
  { href: "/studio/content", label: "Content" },
  { href: "/studio/community", label: "Community" },
  { href: "/studio/monetization", label: "Monetization" },
  { href: "/studio/events", label: "Events" },
  { href: "/studio/ai", label: "AI" },
  { href: "/studio/analytics", label: "Analytics" },
  { href: "/studio/settings", label: "Settings" },
] as const;

export function isNavCurrent(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/studio") {
    return pathname === "/studio";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
