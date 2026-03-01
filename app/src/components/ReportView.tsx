"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import HourlyHeatmap from "./HourlyHeatmap";

export interface ReportData {
  pacing_adherence: number;
  primary_trigger: string;
  secondary_trigger: string | null;
  clinical_observations: string[];
  clinician_message: string;
  severity_trend: "improving" | "stable" | "worsening";
  recommendations: string[];
  summary_stats: {
    avg_starting_spoons: number;
    avg_ending_spoons: number;
    total_weather_deductions: number;
    days_with_crashes: number;
    worst_day: string | null;
    best_day: string | null;
    avg_sleep: number;
    avg_pain: number;
    total_caregiver_claims: number;
    pacing_adherence: number;
  };
  hourly_risk: number[];
  period: { start: string; end: string };
  condition_tags: string[];
  generated_at: string;
}

interface Props {
  report: ReportData;
  shareToken: string | null;
  onClose?: () => void;
}

export default function ReportView({ report, shareToken, onClose }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const trendIcon =
    report.severity_trend === "improving"
      ? "📈"
      : report.severity_trend === "worsening"
        ? "📉"
        : "➡️";

  const trendColor =
    report.severity_trend === "improving"
      ? "text-emerald-400"
      : report.severity_trend === "worsening"
        ? "text-red-400"
        : "text-yellow-400";

  async function exportPDF() {
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = reportRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#F8F8F8",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `SpoonShare-Report-${report.period.start}-to-${report.period.end}.pdf`
      );
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setExporting(false);
    }
  }

  function copyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/report/shared/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-h1 font-bold text-text-primary">
          Patient Status Report
        </h2>
        <div className="flex items-center gap-2">
          {shareToken && (
            <button
              onClick={copyShareLink}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${copied
                  ? "bg-primary/20 text-primary"
                  : "bg-surface text-text-secondary hover:text-text-primary"
                }`}
            >
              {copied ? "Link Copied!" : "Share with Doctor (24h)"}
            </button>
          )}
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-sm font-medium transition-colors duration-200"
          >
            {exporting ? "Exporting..." : "Download PDF"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary transition-colors duration-200"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Report Content (captured for PDF) */}
      <div
        ref={reportRef}
        className="glass-card rounded-card p-grid-4 space-y-grid-4"
      >
        {/* Header */}
        <div className="border-b border-[rgba(255,255,255,0.1)] pb-grid-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-h2 font-bold text-text-primary">
                SpoonShare — Clinical Brief
              </h3>
              <p className="text-data text-text-secondary">
                Reporting Period: {report.period.start} to {report.period.end}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-text-secondary">Generated</p>
              <p className="text-data text-text-primary">
                {new Date(report.generated_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Condition tags */}
          {report.condition_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {report.condition_tags
                .filter((tag) => {
                  const trimmed = tag.trim();
                  if (
                    trimmed === "ME/CFS Pattern" ||
                    trimmed === "Dysautonomia Risk" ||
                    trimmed === "EDS Spectrum" ||
                    trimmed === "Sensory Processing Concern" ||
                    trimmed === "Complex Multi-System"
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((tag) => (
                  <span
                    key={tag}
                    className="px-grid-1 py-[2px] rounded text-[12px] bg-primary/20 text-primary border border-primary/30"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-text-primary">
              {report.pacing_adherence}%
            </p>
            <p className="text-[12px] text-text-secondary">Pacing Adherence</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${trendColor}`}>
              {trendIcon}
            </p>
            <p className="text-[12px] text-text-secondary">
              {report.severity_trend.charAt(0).toUpperCase() +
                report.severity_trend.slice(1)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-text-primary">
              {report.summary_stats.days_with_crashes}
            </p>
            <p className="text-[12px] text-text-secondary">Crash Days</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-text-primary">
              {report.summary_stats.avg_starting_spoons}
            </p>
            <p className="text-[12px] text-text-secondary">Avg Starting</p>
          </div>
        </div>

        {/* Spoon Exhaustion Heatmap */}
        <HourlyHeatmap hourlyRisk={report.hourly_risk} />

        {/* Primary Trigger */}
        <div className="bg-warning/10 border border-warning/30 rounded-card p-grid-3 space-y-grid-1">
          <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
            Primary Trigger Identified
          </h4>
          <p className="text-h2 font-semibold text-warning">
            {report.primary_trigger}
          </p>
          {report.secondary_trigger && (
            <p className="text-data text-text-secondary">
              Secondary: {report.secondary_trigger}
            </p>
          )}
        </div>

        {/* Clinical Observations */}
        <div className="space-y-3">
          <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
            Clinical Observations (HPO-Mapped)
          </h4>
          <ul className="space-y-2">
            {report.clinical_observations.map((obs, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-data text-text-primary"
              >
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weekly Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface rounded-card p-grid-2 text-center border border-[rgba(255,255,255,0.1)]">
            <p className="text-2xl font-semibold text-text-primary">
              {report.summary_stats.avg_sleep}/10
            </p>
            <p className="text-[12px] text-text-secondary">Avg Sleep Quality</p>
          </div>
          <div className="bg-surface rounded-card p-grid-2 text-center border border-[rgba(255,255,255,0.1)]">
            <p className="text-2xl font-semibold text-text-primary">
              {report.summary_stats.avg_pain}/10
            </p>
            <p className="text-[12px] text-text-secondary">Avg Pain Level</p>
          </div>
          <div className="bg-surface rounded-card p-grid-2 text-center border border-[rgba(255,255,255,0.1)]">
            <p className="text-2xl font-semibold text-text-primary">
              -{report.summary_stats.total_weather_deductions}
            </p>
            <p className="text-[12px] text-text-secondary">Weather Deductions</p>
          </div>
        </div>

        {/* Message to Clinician */}
        <div className="bg-primary/10 border border-primary/30 rounded-card p-grid-3 space-y-grid-1">
          <h4 className="text-[12px] font-semibold text-primary uppercase tracking-wide">
            Message to Clinician
          </h4>
          <p className="text-data text-text-primary leading-relaxed">
            {report.clinician_message}
          </p>
        </div>

        {/* Recommendations */}
        <div className="space-y-3">
          <h4 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
            Recommendations for Next Period
          </h4>
          <ul className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-data text-text-primary"
              >
                <span className="text-primary mt-0.5 shrink-0">
                  {i + 1}.
                </span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(255,255,255,0.1)] pt-grid-2 text-center">
          <p className="text-[12px] text-text-secondary">
            Generated by SpoonShare AI Clinical Brief Generator — This report is
            for informational purposes and should be reviewed with a healthcare
            provider.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
