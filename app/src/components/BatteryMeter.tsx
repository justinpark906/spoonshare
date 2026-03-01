"use client";

import { motion } from "framer-motion";

interface Props {
  current: number;
  max: number;
}

function SpoonIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-6 h-6 transition-colors duration-300 ${
        active ? "text-primary" : "text-text-secondary/20"
      }`}
      fill="currentColor"
    >
      <path d="M12 2C9.5 2 7.5 4.5 7.5 7.5c0 2.5 1.5 4.5 3.5 5.3V20c0 .6.4 1 1 1s1-.4 1-1v-7.2c2-0.8 3.5-2.8 3.5-5.3C16.5 4.5 14.5 2 12 2z" />
    </svg>
  );
}

export default function BatteryMeter({ current, max }: Props) {
  const clamped = Math.min(max, Math.max(0, current));
  const percentage = Math.round((clamped / max) * 100);

  return (
    <div
      className="space-y-grid-2"
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Energy level: ${clamped} of ${max} spoons`}
    >
      {/* Spoon grid */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length: max }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <SpoonIcon active={i < clamped} />
          </motion.div>
        ))}
      </div>

      {/* Label */}
      <div className="flex justify-between text-[12px] text-text-secondary">
        <span>Empty</span>
        <span className="font-mono">{percentage}% capacity</span>
        <span>Full</span>
      </div>
    </div>
  );
}
