import { NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWeeklySummary } from "@/lib/weekly-summary";
import { getHPOReferenceContext } from "@/lib/hpo-mapping";

const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";

const clinicalReportSchema = z.object({
  pacing_adherence: z
    .number()
    .min(0)
    .max(100)
    .describe("Percentage of time the patient maintained spoons above minimum safety threshold (2 spoons)"),
  primary_trigger: z
    .string()
    .describe("The #1 identified cause of energy crashes this week, categorized as Environmental, Activity-Based, Sleep-Related, or Pain-Related"),
  secondary_trigger: z
    .string()
    .nullable()
    .describe("Secondary trigger if identified, or null"),
  clinical_observations: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Clinical observations using HPO terminology. Each should reference specific HPO codes where applicable."),
  clinician_message: z
    .string()
    .describe("A professional 2-3 sentence 'Message to Clinician' summarizing the data correlation between triggers and symptoms"),
  severity_trend: z
    .enum(["improving", "stable", "worsening"])
    .describe("Overall trend assessment for the reporting period"),
  recommendations: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("Evidence-based pacing recommendations for the next week"),
});

export type ClinicalReport = z.infer<typeof clinicalReportSchema>;

function hasValidGroqKey(): boolean {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key || key.length < 20) return false;
  if (/your_groq|your-groq|placeholder|example\.com/i.test(key)) return false;
  return true;
}

function getFallbackReport(
  summary: Awaited<ReturnType<typeof getWeeklySummary>>,
): ClinicalReport {
  const primaryTrigger =
    summary.stats.total_weather_deductions > 0
      ? "Environmental"
      : summary.stats.avg_pain >= 6
        ? "Pain-Related"
        : summary.stats.avg_sleep <= 4
          ? "Sleep-Related"
          : "Activity-Based";

  const secondaryTrigger =
    summary.stats.avg_pain >= 5 && primaryTrigger !== "Pain-Related"
      ? "Pain-Related"
      : summary.stats.avg_sleep <= 5 && primaryTrigger !== "Sleep-Related"
        ? "Sleep-Related"
        : null;

  const severityTrend: ClinicalReport["severity_trend"] =
    summary.stats.days_with_crashes >= 3
      ? "worsening"
      : summary.stats.days_with_crashes === 0 && summary.stats.pacing_adherence >= 80
        ? "improving"
        : "stable";

  return {
    pacing_adherence: summary.stats.pacing_adherence,
    primary_trigger: primaryTrigger,
    secondary_trigger: secondaryTrigger,
    clinical_observations: [
      `Frequent low-energy intervals suggest pacing instability over the period (${summary.stats.days_with_crashes} crash day(s)).`,
      `Average sleep score was ${summary.stats.avg_sleep}/10 with mean pain ${summary.stats.avg_pain}/10, indicating measurable recovery burden.`,
      `Weather-associated deductions totaled ${summary.stats.total_weather_deductions} spoons across the reporting window.`,
    ],
    clinician_message:
      "Weekly SpoonShare data demonstrates reproducible symptom-energy coupling with identifiable trigger patterns. Objective pacing adherence and crash-day frequency can be used to guide graded scheduling and symptom-informed activity planning.",
    severity_trend: severityTrend,
    recommendations: [
      "Prioritize low-cost tasks during higher-risk afternoon windows and reserve recovery buffers between moderate/high demand events.",
      "Introduce planned rest intervals after activities predicted to exceed 4 spoons and monitor next-day rebound.",
      "Track sleep and pain trends daily to calibrate morning budget decisions before fixed commitments.",
    ],
  };
}

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Aggregate weekly data
    const summary = await getWeeklySummary(supabase, user.id);

    // Build RAG context
    const hpoContext = getHPOReferenceContext();

    const parser = StructuredOutputParser.fromZodSchema(clinicalReportSchema);

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a clinical data analyst generating a professional medical summary for a rare disease patient's weekly energy management data.

**Your role:** Translate patient-reported data into clinical language using the Human Phenotype Ontology (HPO) standard.

**HPO Reference (use these codes in your observations):**
{hpo_reference}

**Patient Profile:**
- Condition tags: {condition_tags}
- Baseline spoons: {baseline_spoons}
- Current multiplier: {current_multiplier}x
- HPO phenotype scores: {symptom_data}

**Guidelines:**
1. Use formal medical language appropriate for a clinician review
2. Reference specific HPO codes in observations (e.g., "consistent with HP:0012531 Post-exertional malaise")
3. Identify correlations between weather data and symptom exacerbation
4. Note any patterns in sleep-to-crash relationships
5. The pacing_adherence should reflect the computed stat but may be adjusted based on qualitative notes
6. Be objective and data-driven — this is a clinical document, not a wellness blog
7. The clinician_message should be concise and actionable

{format_instructions}`,
      ],
      [
        "human",
        `Here is my weekly data summary:

**Reporting Period:** {period_start} to {period_end}

**Daily Log Statistics:**
- Average starting spoons: {avg_starting}
- Average ending spoons: {avg_ending}
- Days with energy crashes (≤2 spoons): {crash_days} / {total_days}
- Total weather-related deductions: {weather_deductions} spoons
- Average sleep score: {avg_sleep}/10
- Average pain score: {avg_pain}/10
- Pacing adherence: {pacing_adherence}%
- Caregiver interventions: {caregiver_claims}

**Daily Breakdown:**
{daily_breakdown}

**Weather Observations:**
{weather_observations}

**Patient Notes:**
{patient_notes}

Please generate the structured clinical report.`,
      ],
    ]);

    let report: ClinicalReport;

    // Format daily breakdown
    const dailyBreakdown = summary.daily_logs.length > 0
      ? summary.daily_logs
        .map(
          (d) =>
            `${d.date}: Started ${d.starting_spoons}, ended ${d.current_spoons ?? "N/A"}, sleep ${d.sleep_score}/10, pain ${d.pain_score}/10, weather -${d.weather_deduction}${d.deduction_reasons.length > 0 ? ` (${d.deduction_reasons.join("; ")})` : ""}`
        )
        .join("\n")
      : "No daily logs recorded this week (demo mode)";

    const weatherObservations = summary.weather_logs.length > 0
      ? summary.weather_logs
        .map(
          (w) =>
            `${new Date(w.recorded_at).toLocaleDateString()}: ${w.pressure_hpa} hPa, ${w.temperature_c}°C, ${w.weather_condition}`
        )
        .join("\n")
      : "No weather data recorded (demo mode)";

    const patientNotes = summary.user_notes.length > 0
      ? summary.user_notes.map((n) => `${n.date}: "${n.content}"`).join("\n")
      : "No patient notes this week";

    if (hasValidGroqKey()) {
      try {
        const model = new ChatGroq({
          model: GROQ_MODEL,
          temperature: 0.2,
          apiKey: process.env.GROQ_API_KEY,
        });

        const chain = prompt.pipe(model).pipe(parser);
        report = await chain.invoke({
          hpo_reference: hpoContext,
          condition_tags: (profile.condition_tags || []).join(", ") || "Not specified",
          baseline_spoons: profile.baseline_spoons.toString(),
          current_multiplier: profile.current_multiplier.toString(),
          symptom_data: JSON.stringify(profile.symptom_data || {}),
          period_start: summary.period.start,
          period_end: summary.period.end,
          avg_starting: summary.stats.avg_starting_spoons.toString(),
          avg_ending: summary.stats.avg_ending_spoons.toString(),
          crash_days: summary.stats.days_with_crashes.toString(),
          total_days: summary.daily_logs.length.toString(),
          weather_deductions: summary.stats.total_weather_deductions.toString(),
          avg_sleep: summary.stats.avg_sleep.toString(),
          avg_pain: summary.stats.avg_pain.toString(),
          pacing_adherence: summary.stats.pacing_adherence.toString(),
          caregiver_claims: summary.stats.total_caregiver_claims.toString(),
          daily_breakdown: dailyBreakdown,
          weather_observations: weatherObservations,
          patient_notes: patientNotes,
          format_instructions: parser.getFormatInstructions(),
        });
      } catch (groqErr) {
        console.error("Generate report AI fallback:", groqErr);
        report = getFallbackReport(summary);
      }
    } else {
      report = getFallbackReport(summary);
    }

    // Save report to Supabase for sharing
    const fullReportData = {
      ...report,
      summary_stats: summary.stats,
      hourly_risk: summary.hourly_risk,
      period: summary.period,
      condition_tags: profile.condition_tags || [],
      generated_at: new Date().toISOString(),
    };

    const { data: savedReport, error: saveError } = await supabase
      .from("reports")
      .insert({
        user_id: user.id,
        report_data: fullReportData,
      })
      .select("id, share_token")
      .single();

    if (saveError) {
      console.error("Report save error:", saveError);
    }

    return NextResponse.json({
      success: true,
      report: fullReportData,
      share_token: savedReport?.share_token ?? null,
    });
  } catch (err) {
    console.error("Generate report error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
