"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { dueReviews, today } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { IconAudio, IconInfo, IconLibrary, IconPath, IconReview, IconSettings, IconToday } from "./Icons";

const PRIMARY = [
  { href: "/today", label: "Today", Icon: IconToday },
  { href: "/path", label: "Path", Icon: IconPath },
  { href: "/review", label: "Review", Icon: IconReview, badge: true },
  { href: "/library", label: "Library", Icon: IconLibrary },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];
const SECONDARY = [
  { href: "/audio", label: "Audio studio", Icon: IconAudio },
  { href: "/about", label: "About & disclaimers", Icon: IconInfo },
];

function isActive(pathname: string, href: string) {
  if (href === "/path") return pathname === "/path" || pathname.startsWith("/lessons");
  if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/drafts");
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const snap = useStore();
  const dueCount = snap.status === "ready" && snap.state.profile && snap.state.settings.notifications === "in_app" ? dueReviews(snap.state, today(snap.state)).length : 0;
  const onboarding = pathname === "/welcome" || (snap.status === "ready" && !snap.state.profile && pathname === "/");
  const navLabel = (label: string, badge?: boolean) =>
    badge && dueCount > 0 ? `${label}, ${dueCount} due` : label;

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="SpecLoop Academy home">
          <span className="brand-mark" aria-hidden="true">SL</span>
          <span>SpecLoop Academy</span>
        </Link>
        <span className="spacer" />
        <Link href="/about#demo-mode" className="demo-pill" title="Data is stored only in this browser. Not secure multi-user auth.">
          Local demo mode
        </Link>
      </header>
      <div className="layout">
        {!onboarding && (
          <nav className="sidenav" aria-label="Main">
            <ul>
              {PRIMARY.map(({ href, label, Icon, badge }) => (
                <li key={href}>
                  <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined} aria-label={navLabel(label, badge)}>
                    <Icon className="nav-icon" />
                    <span>{label}</span>
                    {badge && dueCount > 0 && <span className="nav-badge" aria-hidden="true">{dueCount}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="nav-section">Tools</div>
            <ul>
              {SECONDARY.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
                    <Icon className="nav-icon" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <main id="main" className="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      {!onboarding && (
        <nav className="bottomnav" aria-label="Main">
          {PRIMARY.map(({ href, label, Icon, badge }) => (
            <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined} aria-label={navLabel(label, badge)}>
              <Icon className="nav-icon" />
              <span aria-hidden="true">{label}</span>
              {badge && dueCount > 0 && <span className="nav-badge" aria-hidden="true">{dueCount}</span>}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
