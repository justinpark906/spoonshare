import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWeeklySummary } from "@/lib/weekly-summary";
import { getHPOReferenceContext } from "@/lib/hpo-mapping";

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

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.2,
    });

    const chain = prompt.pipe(model).pipe(parser);

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

    const report = await chain.invoke({
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
