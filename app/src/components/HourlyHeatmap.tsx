"use client";

interface Props {
  hourlyRisk: number[];
}

const HOUR_LABELS = [
  "12a", "1a", "2a", "3a", "4a", "5a",
  "6a", "7a", "8a", "9a", "10a", "11a",
  "12p", "1p", "2p", "3p", "4p", "5p",
  "6p", "7p", "8p", "9p", "10p", "11p",
];

function getRiskColor(risk: number): string {
  if (risk <= 1) return "bg-emerald-900/40";
  if (risk <= 2) return "bg-emerald-700/50";
  if (risk <= 3) return "bg-yellow-700/40";
  if (risk <= 4) return "bg-yellow-600/50";
  if (risk <= 5) return "bg-orange-600/50";
  if (risk <= 6) return "bg-orange-500/60";
  if (risk <= 7) return "bg-red-600/50";
  if (risk <= 8) return "bg-red-500/60";
  return "bg-red-500/80";
}

export default function HourlyHeatmap({ hourlyRisk }: Props) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Spoon Exhaustion Heatmap — Hourly Risk
      </h4>
      <div className="grid grid-cols-12 gap-1">
        {hourlyRisk.map((risk, hour) => (
          <div key={hour} className="text-center">
            <div
              className={`h-8 rounded ${getRiskColor(risk)} flex items-center justify-center`}
              title={`${HOUR_LABELS[hour]}: Risk ${risk}/10`}
            >
              <span className="text-[10px] text-white/70">{risk}</span>
            </div>
            <span className="text-[9px] text-slate-600 mt-0.5 block">
              {hour % 3 === 0 ? HOUR_LABELS[hour] : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-2">
        <span className="text-[10px] text-slate-500">Low Risk</span>
        <div className="flex gap-0.5">
          {[1, 3, 5, 7, 9].map((r) => (
            <div
              key={r}
              className={`w-3 h-3 rounded-sm ${getRiskColor(r)}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-slate-500">High Risk</span>
      </div>
    </div>
  );
}
