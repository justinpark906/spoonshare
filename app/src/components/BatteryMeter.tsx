"use client";

import { motion } from "framer-motion";

interface Props {
  current: number;
  max: number;
}

export default function BatteryMeter({ current, max }: Props) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));

  const getColor = (pct: number) => {
    if (pct <= 15) return { bar: "bg-red-500", glow: "shadow-red-500/40" };
    if (pct <= 35) return { bar: "bg-orange-500", glow: "shadow-orange-500/40" };
    if (pct <= 60) return { bar: "bg-yellow-500", glow: "shadow-yellow-500/40" };
    return { bar: "bg-emerald-500", glow: "shadow-emerald-500/40" };
  };

  const { bar, glow } = getColor(percentage);

  return (
    <div className="space-y-3">
      {/* Battery shell */}
      <div className="relative">
        <div className="w-full h-12 bg-slate-800 rounded-xl border-2 border-slate-700 overflow-hidden relative">
          {/* Fill bar */}
          <motion.div
            className={`absolute inset-y-0 left-0 ${bar} rounded-lg shadow-lg ${glow}`}
            initial={{ width: "0%" }}
            animate={{ width: `${percentage}%` }}
            transition={{
              duration: 1.5,
              ease: [0.34, 1.56, 0.64, 1], // spring-like overshoot
            }}
          />

          {/* Spoon count overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              className="text-white font-bold text-lg drop-shadow-md"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              {current} / {max} spoons
            </motion.span>
          </div>
        </div>

        {/* Battery nub */}
        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-2 h-6 bg-slate-700 rounded-r-sm" />
      </div>

      {/* Percentage label */}
      <div className="flex justify-between text-xs text-slate-500">
        <span>Empty</span>
        <span>{Math.round(percentage)}% capacity</span>
        <span>Full</span>
      </div>
    </div>
  );
}
