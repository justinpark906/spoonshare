"use client";

import Logo from "./Logo";
import { usePathname, useRouter } from "next/navigation";
import { useSpoonStore } from "@/store/useSpoonStore";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Site header with logo always at the top. Shows Sign Out when authenticated, Log In when not.
 */
export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useSpoonStore((s) => s.isAuthenticated);
  const logout = useSpoonStore((s) => s.logout);

  const isPublicPage =
    pathname?.startsWith("/status/") || pathname?.startsWith("/report/shared/");
  const showSignOut = isAuthenticated && pathname !== "/login" && !isPublicPage;
  const showLogIn = !isAuthenticated && pathname !== "/login" && !isPublicPage;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
    router.push("/login");
  }

  return (
    <header
      className="flex items-center justify-between gap-4 w-full border-b border-primary-pale/50 bg-surface px-4 py-3 md:px-6"
      role="banner"
    >
      <Logo />
      <div className="flex items-center gap-2 flex-shrink-0">
        {showLogIn && (
          <Link
            href="/login"
            className="text-data font-medium text-primary hover:text-primary-light transition-colors"
          >
            Log In
          </Link>
        )}
        {showSignOut && (
          <button
            type="button"
            onClick={handleSignOut}
            className="text-data text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Sign out"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
