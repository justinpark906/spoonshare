"use client";

import { Phenotype } from "@/lib/phenotypes";

interface Props {
  phenotype: Phenotype;
  value: number;
  onChange: (value: number) => void;
}

export default function PhenotypeSlider({ phenotype, value, onChange }: Props) {
  const getSeverityLabel = (val: number) => {
    if (val <= 2) return "Minimal";
    if (val <= 4) return "Mild";
    if (val <= 6) return "Moderate";
    if (val <= 8) return "Severe";
    return "Extreme";
  };

  const getSeverityColor = (val: number) => {
    if (val <= 2) return "text-emerald-400";
    if (val <= 4) return "text-yellow-400";
    if (val <= 6) return "text-orange-400";
    if (val <= 8) return "text-red-400";
    return "text-red-500";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{phenotype.icon}</span>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            {phenotype.name}
          </h3>
        </div>
      </div>

      <p className="text-text-secondary">{phenotype.description}</p>

      <div className="space-y-2">
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-primary-pale/50 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-muted">1</span>
          <span className={`text-sm font-medium ${getSeverityColor(value)}`}>
            {value}/10 — {getSeverityLabel(value)}
          </span>
          <span className="text-xs text-text-muted">10</span>
        </div>
      </div>
    </div>
  );
}
