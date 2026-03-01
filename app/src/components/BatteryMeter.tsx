"use client";

import { motion } from "framer-motion";

interface Props {
  current: number;
  max: number;
}

export default function BatteryMeter({ current, max }: Props) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));

  // MASTER.md colors: primary #2dd4bf, warning #f59e0b, critical #e11d48
  const getColor = (pct: number) => {
    if (pct <= 15) return { bar: "bg-critical", glow: "shadow-critical/40" };
    if (pct <= 35) return { bar: "bg-warning", glow: "shadow-warning/40" };
    if (pct <= 60) return { bar: "bg-warning", glow: "shadow-warning/40" };
    return { bar: "bg-primary", glow: "shadow-primary/40" };
  };

  const { bar, glow } = getColor(percentage);

  return (
    <div
      className="space-y-grid-2"
      role="meter"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Energy level: ${current} of ${max} spoons`}
    >
      {/* Battery shell */}
      <div className="relative">
        <div className="w-full h-[48px] bg-surface rounded-card border border-primary-pale/50 overflow-hidden relative">
          {/* Fill bar */}
          <motion.div
            className={`absolute inset-y-0 left-0 ${bar} rounded-[10px] shadow-lg ${glow}`}
            initial={{ width: "0%" }}
            animate={{ width: `${percentage}%` }}
            transition={{
              duration: 1.5,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          />

          {/* Spoon count overlay — font-mono per MASTER.md §2 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              className="text-text-primary font-bold text-h2 font-mono drop-shadow-md"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              {current} / {max} spoons
            </motion.span>
          </div>
        </div>

        {/* Battery nub */}
        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-2 h-6 bg-surface rounded-r-sm border border-primary-pale/50 border-l-0" />
      </div>

      {/* Percentage label */}
      <div className="flex justify-between text-[12px] text-text-secondary">
        <span>Empty</span>
        <span className="font-mono">{Math.round(percentage)}% capacity</span>
        <span>Full</span>
      </div>
    </div>
  );
}
