import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router";
import { LogOutIcon } from "lucide-react";
import { useTheme } from "#hooks/useTheme";
import { ScrollFade } from "#components/ScrollFade";
import { Button } from "#components/ui/button";
import { BackToTop } from "#components/BackToTop";
import { HeaderMenu } from "#components/HeaderMenu";
import { LanguageMenu } from "#components/LanguageMenu";
import { ThemeToggle } from "#components/ThemeToggle";
import { syncLocaleWithServer, m } from "#lib/i18n";
import { cn } from "#lib/utils";
import { authClient } from "#lib/auth-client";
import { clearQueryCache } from "#lib/query-client";

/** Login URL that returns here afterwards. */
function loginUrl() {
  const here = window.location.pathname + window.location.search;
  return here === "/" ? "/login" : `/login?redirect=${encodeURIComponent(here)}`;
}

export function AppShell() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { mode, nextMode, cycle, setMode } = useTheme();

  useEffect(() => {
    // The API also enforces the email allowlist; a session alone isn't enough.
    fetch("/api/me")
      .then((r) => {
        setAuthed(r.ok);
        if (!r.ok) navigate(loginUrl());
        else syncLocaleWithServer();
      })
      .catch(() => navigate(loginUrl()));
  }, [navigate]);

  async function signOut() {
    await authClient.signOut();
    // Cached responses stay on disk otherwise; the next person here shouldn't see them.
    await clearQueryCache();
    navigate("/login");
  }

  // Render nothing until the session is confirmed, so pages never fetch unauthenticated.
  if (authed !== true) return null;

  const navItems = [
    { to: "/", label: m.nav_messages(), end: true },
    { to: "/tasks", label: m.nav_tasks() },
    { to: "/events", label: m.nav_events() },
    { to: "/trash", label: m.nav_trash() },
    { to: "/settings", label: m.nav_settings() },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 md:gap-6">
          <Link to="/" className="shrink-0 font-heading font-bold tracking-tight">
            Stash
          </Link>
          <ScrollFade as="nav" className="-my-2 flex flex-1 gap-1 py-2 md:flex-none">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item}
                className={({ isActive }) =>
                  cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </ScrollFade>
          <div className="ml-auto flex shrink-0 items-center gap-1 max-sm:hidden">
            <LanguageMenu />
            <ThemeToggle mode={mode} nextMode={nextMode} onCycle={cycle} />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOutIcon />
              {m.nav_sign_out()}
            </Button>
          </div>
          <div className="ml-auto shrink-0 sm:hidden">
            <HeaderMenu mode={mode} onModeChange={setMode} onSignOut={signOut} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <BackToTop />
    </div>
  );
}
