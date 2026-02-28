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
    <div className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="text-sm text-slate-400 hover:text-white transition mb-6 flex items-center gap-1"
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-6">
            <div className="text-5xl">📋</div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Clinical Brief Generator
              </h1>
              <p className="mt-2 text-slate-400 max-w-md mx-auto">
                Generate a professional, HPO-mapped medical summary from your
                last 7 days of energy data. Share it with your doctor to prove
                the correlation between your triggers and symptoms.
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm max-w-md mx-auto">
                {error}
              </div>
            )}

            <button
              onClick={generateReport}
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg transition"
            >
              {loading
                ? "Analyzing 7 days of data..."
                : "Generate My Clinical Brief"}
            </button>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-white">HPO</p>
                <p className="text-xs text-slate-500">Standard Codes</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">7 Days</p>
                <p className="text-xs text-slate-500">Data Analysis</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">PDF</p>
                <p className="text-xs text-slate-500">Export Ready</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
