"use client";

import Link from "next/link";
import Image from "next/image";

/** Logo from brand image (spoon + heart + SPOONSHARE). Shown at top of every page. */
export default function Logo({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "compact";
  className?: string;
}) {
  const isCompact = variant === "compact";
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-3 no-underline ${className}`}
      aria-label="SpoonShare — Proactive Energy Management"
    >
      <Image
        src="/logo.png"
        alt=""
        width={isCompact ? 40 : 56}
        height={isCompact ? 40 : 56}
        className="flex-shrink-0"
        priority
      />
      {!isCompact && (
        <div className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-text-primary">
            SPOONSHARE
          </span>
          <span className="text-xs font-normal text-text-secondary">
            Proactive Energy Management
          </span>
        </div>
      )}
    </Link>
  );
}
