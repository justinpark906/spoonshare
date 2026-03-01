"use client";

interface Props {
  hourlyRisk: number[];
}

const HOUR_LABELS = [
  "12a",
  "1a",
  "2a",
  "3a",
  "4a",
  "5a",
  "6a",
  "7a",
  "8a",
  "9a",
  "10a",
  "11a",
  "12p",
  "1p",
  "2p",
  "3p",
  "4p",
  "5p",
  "6p",
  "7p",
  "8p",
  "9p",
  "10p",
  "11p",
];

// MASTER.md: primary #2dd4bf, warning #f59e0b, critical #e11d48
function getRiskColor(risk: number): string {
  if (risk <= 2) return "bg-primary/20";
  if (risk <= 4) return "bg-primary/40";
  if (risk <= 5) return "bg-warning/30";
  if (risk <= 6) return "bg-warning/50";
  if (risk <= 7) return "bg-critical/30";
  if (risk <= 8) return "bg-critical/50";
  return "bg-critical/70";
}

export default function HourlyHeatmap({ hourlyRisk }: Props) {
  return (
    <div>
      <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-grid-2">
        Spoon Exhaustion Heatmap — Hourly Risk
      </h4>
      <div
        className="grid grid-cols-12 gap-[4px]"
        role="img"
        aria-label="Hourly spoon exhaustion heatmap"
      >
        {hourlyRisk.map((risk, hour) => (
          <div key={hour} className="text-center">
            <div
              className={`h-grid-4 rounded ${getRiskColor(risk)} flex items-center justify-center`}
              title={`${HOUR_LABELS[hour]}: Risk ${risk}/10`}
            >
              <span className="text-[10px] font-mono text-text-primary/70">
                {risk}
              </span>
            </div>
            <span className="text-[9px] text-text-secondary/60 mt-[2px] block">
              {hour % 3 === 0 ? HOUR_LABELS[hour] : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-grid-1 mt-grid-1">
        <span className="text-[10px] text-text-secondary">Low Risk</span>
        <div className="flex gap-[2px]">
          {[1, 3, 5, 7, 9].map((r) => (
            <div
              key={r}
              className={`w-[12px] h-[12px] rounded-sm ${getRiskColor(r)}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-text-secondary">High Risk</span>
      </div>
    </div>
  );
}
