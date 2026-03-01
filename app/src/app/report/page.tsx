"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReportView, { ReportData } from "@/components/ReportView";

export default function ReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function generateReport() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate report");
      }

      const data = await res.json();
      setReport(data.report);
      setShareToken(data.share_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-grid-3 py-grid-4 md:px-grid-5">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="text-data text-text-secondary hover:text-text-primary transition-colors duration-200 mb-grid-3 flex items-center gap-grid-1 cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </button>

        {report ? (
          <ReportView
            report={report}
            shareToken={shareToken}
            onClose={() => setReport(null)}
          />
        ) : (
          <div className="glass-card rounded-card p-grid-4 text-center space-y-grid-3">
            <div className="text-5xl">📋</div>
            <div>
              <h1 className="text-h1 font-bold text-text-primary">
                Clinical Brief Generator
              </h1>
              <p className="mt-grid-1 text-body text-text-secondary max-w-md mx-auto">
                Generate a professional, HPO-mapped medical summary from your
                last 7 days of energy data. Share it with your doctor to prove
                the correlation between your triggers and symptoms.
              </p>
            </div>

            {error && (
              <div className="bg-critical/10 border border-critical/30 text-critical rounded-card p-grid-2 text-data max-w-md mx-auto">
                {error}
              </div>
            )}

            <button
              onClick={generateReport}
              disabled={loading}
              className="px-grid-4 py-grid-2 rounded-pill bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold text-body transition-colors duration-200 cursor-pointer"
            >
              {loading
                ? "Analyzing 7 days of data..."
                : "Generate My Clinical Brief"}
            </button>

            <div className="grid grid-cols-3 gap-grid-2 max-w-md mx-auto pt-grid-2">
              <div className="text-center">
                <p className="text-h2 font-semibold text-text-primary">HPO</p>
                <p className="text-[12px] text-text-secondary">Standard Codes</p>
              </div>
              <div className="text-center">
                <p className="text-h2 font-semibold text-text-primary">7 Days</p>
                <p className="text-[12px] text-text-secondary">Data Analysis</p>
              </div>
              <div className="text-center">
                <p className="text-h2 font-semibold text-text-primary">PDF</p>
                <p className="text-[12px] text-text-secondary">Export Ready</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
