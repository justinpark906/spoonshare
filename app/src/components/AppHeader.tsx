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
  const showSignIn = !isAuthenticated && pathname !== "/login" && !isPublicPage;
  const showDashboard =
    isAuthenticated &&
    pathname !== "/dashboard" &&
    pathname !== "/login" &&
    !isPublicPage;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    logout();
    router.push("/");
  }

  return (
    <header
      className="flex items-center justify-between gap-4 w-full border-b border-primary-pale/50 bg-surface px-4 py-3 md:px-6"
      role="banner"
    >
      <Logo linkTo={isAuthenticated ? "/dashboard" : "/"} />
      <div className="flex items-center gap-3 flex-shrink-0">
        {showSignIn && (
          <Link
            href="/login"
            className="text-data font-medium text-primary hover:text-primary-light transition-colors"
          >
            Sign In
          </Link>
        )}
        {showDashboard && (
          <Link
            href="/dashboard"
            className="px-grid-2 py-grid-1 rounded-pill bg-primary hover:bg-primary/80 text-background text-data font-medium transition-colors duration-200"
          >
            Go to Dashboard
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
