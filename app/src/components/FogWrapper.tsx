"use client";

import { type ReactNode } from "react";
import FogProvider, { useFog } from "./FogProvider";
import ClearFogButton from "./ClearFogButton";

function FogContent({ children }: { children: ReactNode }) {
  const { filterStyle } = useFog();

  return (
    <>
      <div style={filterStyle}>{children}</div>
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
