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
        backgroundColor: "#0f172a",
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
        <h2 className="text-xl font-bold text-white">
          Patient Status Report
        </h2>
        <div className="flex items-center gap-2">
          {shareToken && (
            <button
              onClick={copyShareLink}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                copied
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {copied ? "Link Copied!" : "Share with Doctor (24h)"}
            </button>
          )}
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition"
          >
            {exporting ? "Exporting..." : "Download PDF"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-slate-400 hover:text-white transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Report Content (captured for PDF) */}
      <div
        ref={reportRef}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-8"
      >
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                SpoonShare — Clinical Brief
              </h3>
              <p className="text-sm text-slate-400">
                Reporting Period: {report.period.start} to {report.period.end}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Generated</p>
              <p className="text-sm text-slate-300">
                {new Date(report.generated_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Condition tags */}
          {report.condition_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {report.condition_tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30"
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
            <p className="text-3xl font-bold text-white">
              {report.pacing_adherence}%
            </p>
            <p className="text-xs text-slate-500">Pacing Adherence</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${trendColor}`}>
              {trendIcon}
            </p>
            <p className="text-xs text-slate-500">
              {report.severity_trend.charAt(0).toUpperCase() +
                report.severity_trend.slice(1)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white">
              {report.summary_stats.days_with_crashes}
            </p>
            <p className="text-xs text-slate-500">Crash Days</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white">
              {report.summary_stats.avg_starting_spoons}
            </p>
            <p className="text-xs text-slate-500">Avg Starting</p>
          </div>
        </div>

        {/* Spoon Exhaustion Heatmap */}
        <HourlyHeatmap hourlyRisk={report.hourly_risk} />

        {/* Primary Trigger */}
        <div className="bg-slate-800/50 rounded-xl p-5 space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Primary Trigger Identified
          </h4>
          <p className="text-lg font-semibold text-orange-400">
            {report.primary_trigger}
          </p>
          {report.secondary_trigger && (
            <p className="text-sm text-slate-400">
              Secondary: {report.secondary_trigger}
            </p>
          )}
        </div>

        {/* Clinical Observations */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Clinical Observations (HPO-Mapped)
          </h4>
          <ul className="space-y-2">
            {report.clinical_observations.map((obs, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-slate-200"
              >
                <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weekly Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-white">
              {report.summary_stats.avg_sleep}/10
            </p>
            <p className="text-xs text-slate-500">Avg Sleep Quality</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-white">
              {report.summary_stats.avg_pain}/10
            </p>
            <p className="text-xs text-slate-500">Avg Pain Level</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-white">
              -{report.summary_stats.total_weather_deductions}
            </p>
            <p className="text-xs text-slate-500">Weather Deductions</p>
          </div>
        </div>

        {/* Message to Clinician */}
        <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-5 space-y-2">
          <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wide">
            Message to Clinician
          </h4>
          <p className="text-sm text-slate-200 leading-relaxed">
            {report.clinician_message}
          </p>
        </div>

        {/* Recommendations */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Recommendations for Next Period
          </h4>
          <ul className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <span className="text-emerald-400 mt-0.5 shrink-0">
                  {i + 1}.
                </span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-600">
            Generated by SpoonShare AI Clinical Brief Generator — This report is
            for informational purposes and should be reviewed with a healthcare
            provider.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
