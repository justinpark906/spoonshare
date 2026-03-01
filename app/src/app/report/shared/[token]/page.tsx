"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ReportView, { ReportData } from "@/components/ReportView";

export default function SharedReportPage() {
  const params = useParams();
  const token = params.token as string;
  const supabase = createClient();

  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadReport() {
    const { data, error: fetchError } = await supabase
      .from("reports")
      .select("report_data, expires_at")
      .eq("share_token", token)
      .single();

    if (fetchError || !data) {
      setError("Report not found or link is invalid.");
      setLoading(false);
      return;
    }

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      setError("This report link has expired (24-hour limit).");
      setLoading(false);
      return;
    }

    setReport(data.report_data as ReportData);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading report...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">📋</div>
          <h1 className="text-xl font-bold text-text-primary">Report Unavailable</h1>
          <p className="text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-sm text-text-secondary">
            SpoonShare — Shared Clinical Brief (expires in 24 hours)
          </p>
        </div>
        <ReportView report={report} shareToken={null} />
      </div>
    </div>
  );
}
