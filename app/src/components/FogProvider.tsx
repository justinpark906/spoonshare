"use client";

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useSpoonStore } from "@/store/useSpoonStore";

type FogLevel = "healthy" | "warning" | "critical" | "emergency";

interface FogContextValue {
  fogLevel: FogLevel;
  spoonPercentage: number;
  filterStyle: React.CSSProperties;
  navFilterStyle: React.CSSProperties;
  /** Wraps a click handler with cognitive lag if energy < 10% */
  withCognitiveLag: <T extends (...args: unknown[]) => void>(fn: T) => T;
  /** Framer Motion transition duration multiplier */
  motionMultiplier: number;
}

const FogContext = createContext<FogContextValue>({
  fogLevel: "healthy",
  spoonPercentage: 100,
  filterStyle: {},
  navFilterStyle: {},
  withCognitiveLag: (fn) => fn,
  motionMultiplier: 1,
});

export function useFog() {
  return useContext(FogContext);
}

function getFogLevel(percentage: number): FogLevel {
  if (percentage > 30) return "healthy";
  if (percentage > 15) return "warning";
  if (percentage > 10) return "critical";
  return "emergency";
}

function getFilterStyle(level: FogLevel): React.CSSProperties {
  switch (level) {
    case "healthy":
      return {
        filter: "none",
        transition: "filter 1s ease-in-out",
      };
    case "warning":
      return {
        filter: "blur(1px) saturate(80%)",
        transition: "filter 1s ease-in-out",
      };
    case "critical":
      return {
        filter: "blur(3px) grayscale(90%) brightness(90%)",
        transition: "filter 1s ease-in-out",
      };
    case "emergency":
      return {
        filter: "blur(4px) grayscale(100%) brightness(80%)",
        transition: "filter 1s ease-in-out",
      };
  }
}

function getNavFilterStyle(level: FogLevel): React.CSSProperties {
  // Nav stays more readable — half the effect
  switch (level) {
    case "healthy":
      return { filter: "none", transition: "filter 1s ease-in-out" };
    case "warning":
      return { filter: "saturate(90%)", transition: "filter 1s ease-in-out" };
    case "critical":
      return {
        filter: "blur(1px) saturate(70%) brightness(95%)",
        transition: "filter 1s ease-in-out",
      };
    case "emergency":
      return {
        filter: "blur(1.5px) grayscale(50%) brightness(90%)",
        transition: "filter 1s ease-in-out",
      };
  }
}

export default function FogProvider({ children }: { children: ReactNode }) {
  const { effectiveSpoons } = useSpoonStore();

  const maxSpoons = 20;

  const spoonPercentage = useMemo(
    () => (maxSpoons > 0 ? (effectiveSpoons / maxSpoons) * 100 : 100),
    [effectiveSpoons, maxSpoons]
  );

  const fogLevel = useMemo(() => getFogLevel(spoonPercentage), [spoonPercentage]);

  const filterStyle = useMemo(() => getFilterStyle(fogLevel), [fogLevel]);
  const navFilterStyle = useMemo(() => getNavFilterStyle(fogLevel), [fogLevel]);

  const isEmergency = fogLevel === "emergency";
  const motionMultiplier = isEmergency ? 2 : 1; // 0.5x speed = 2x duration

  const withCognitiveLag = useCallback(
    <T extends (...args: unknown[]) => void>(fn: T): T => {
      if (!isEmergency) return fn;

      const wrapped = (...args: unknown[]) => {
        setTimeout(() => fn(...args), 400);
      };
      return wrapped as unknown as T;
    },
    [isEmergency]
  );

  const value = useMemo(
    () => ({
      fogLevel,
      spoonPercentage,
      filterStyle,
      navFilterStyle,
      withCognitiveLag,
      motionMultiplier,
    }),
    [fogLevel, spoonPercentage, filterStyle, navFilterStyle, withCognitiveLag, motionMultiplier]
  );

  // Smoke/mist overlay opacity by level — no blur on content, just atmospheric background
  const mistOpacity = useMemo(() => {
    switch (fogLevel) {
      case "healthy": return 0;
      case "warning": return 0.25;
      case "critical": return 0.5;
      case "emergency": return 0.75;
    }
  }, [fogLevel]);

  return (
    <FogContext.Provider value={value}>
      {/* Smoke/misty background layer — gets denser as energy drops; content stays sharp */}
      <div
        className="fixed inset-0 pointer-events-none z-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 140% 80% at 50% 10%, rgba(255,255,255,0.12) 0%, transparent 50%), radial-gradient(ellipse 100% 120% at 80% 70%, rgba(240,248,255,0.08) 0%, transparent 45%), radial-gradient(ellipse 100% 100% at 20% 50%, rgba(230,240,250,0.1) 0%, transparent 50%)",
          opacity: mistOpacity,
          transition: "opacity 1s ease-in-out",
        }}
      />
      {children}
    </FogContext.Provider>
  );
}
