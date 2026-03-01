"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import FogProvider from "./FogProvider";
import ClearFogButton from "./ClearFogButton";

function FogContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideRestButton = pathname?.startsWith("/status/");

  return (
    <>
      {children}
      {!hideRestButton && <ClearFogButton />}
    </>
  );
}

export default function FogWrapper({ children }: { children: ReactNode }) {
  return (
    <FogProvider>
      <FogContent>{children}</FogContent>
    </FogProvider>
  );
}
