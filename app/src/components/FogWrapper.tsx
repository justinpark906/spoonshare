"use client";

import { type ReactNode } from "react";
import FogProvider from "./FogProvider";
import ClearFogButton from "./ClearFogButton";

function FogContent({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ClearFogButton />
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
