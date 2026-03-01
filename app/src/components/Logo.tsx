"use client";

import Link from "next/link";
import Image from "next/image";

/** Logo from brand image (spoon + heart + SPOONSHARE). Shown at top of every page. */
export default function Logo({
  variant = "default",
  className = "",
  linkTo = "/",
}: {
  variant?: "default" | "compact";
  className?: string;
  linkTo?: string;
}) {
  const isCompact = variant === "compact";
  return (
    <Link
      href={linkTo}
      className={`inline-flex items-center gap-3 no-underline ${className}`}
      aria-label="SpoonShare — Proactive Energy Management"
    >
      <Image
        src="/logo.png"
        alt=""
        width={isCompact ? 48 : 72}
        height={isCompact ? 48 : 72}
        className="flex-shrink-0"
        priority
      />
    </Link>
  );
}
