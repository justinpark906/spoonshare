import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChatGroq } from "@langchain/groq";
import { getCalendarEvents } from "@/lib/google-calendar";

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "condition_tags, impact_tier, activity_multiplier, identified_condition, baseline_spoons",
      )
      .eq("id", user.id)
      .single();

    // Fetch today's daily log
    const today = new Date().toISOString().split("T")[0];
    const { data: dailyLog } = await supabase
      .from("daily_logs")
      .select(
        "starting_spoons, current_spoons, sleep_score, pain_score, weather_deduction, pressure_hpa, temperature_c, deduction_reasons, claimed_tasks",
      )
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    // Fetch today's manual events
    const dayStart = new Date(today + "T00:00:00.000Z").toISOString();
    const dayEnd = new Date(today + "T23:59:59.999Z").toISOString();
    const { data: manualEvents } = await supabase
      .from("manual_events")
      .select("title, spoon_cost, category, start_time")
      .eq("user_id", user.id)
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd)
      .order("start_time", { ascending: true });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({
        risk_level: "low",
        label: "Energy Stable",
        insight: "AI insight unavailable. Your energy data looks normal.",
        action_label: "No action needed",
        action_type: "none",
      });
    }

    // Build context
    const impactTier = profile?.impact_tier ?? 2;
    const multiplier = Number(profile?.activity_multiplier) || 1;
    const conditionTags = profile?.condition_tags ?? [];
    const condition = profile?.identified_condition ?? "Unknown condition";
    const startingSpoons = dailyLog?.starting_spoons ?? 15;
    const currentSpoons = dailyLog?.current_spoons ?? startingSpoons;
    const sleepScore = dailyLog?.sleep_score ?? 5;
    const painScore = dailyLog?.pain_score ?? 5;
    const weatherDeduction = dailyLog?.weather_deduction ?? 0;
    const temperature = dailyLog?.temperature_c ?? null;
    const events = manualEvents ?? [];
    const nowTs = Date.now();
    const claimedTasks =
      (dailyLog?.claimed_tasks as
        | Array<{ spoon_cost?: number; event_title?: string; caregiver_name?: string }>
        | undefined) ?? [];

    const spentSoFar = events.reduce((sum, e) => {
      const ts = new Date(e.start_time).getTime();
      if (!Number.isFinite(ts) || ts > nowTs) return sum;
      return e.category === "rest" ? sum : sum + Number(e.spoon_cost ?? 0);
    }, 0);

    const restoredSoFar =
      events.reduce((sum, e) => {
        const ts = new Date(e.start_time).getTime();
        if (!Number.isFinite(ts) || ts > nowTs) return sum;
        return e.category === "rest" ? sum + Number(e.spoon_cost ?? 0) : sum;
      }, 0) +
      claimedTasks.reduce((sum, c) => sum + Number(c.spoon_cost ?? 0), 0);

    const upcomingManual = events.filter((e) => {
      const ts = new Date(e.start_time).getTime();
      return Number.isFinite(ts) && ts >= nowTs;
    });

    let upcomingEventsDescription = "No upcoming events in the next 24 hours.";
    if (providerToken) {
      try {
        const googleEvents = await getCalendarEvents(providerToken);
        if (googleEvents.length > 0) {
          upcomingEventsDescription = googleEvents
            .slice(0, 8)
            .map(
              (e) =>
                `- ${e.title} at ${new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (${e.duration_minutes} min)`,
            )
            .join("\n");
        }
      } catch {
        // ignore and fall back to manual upcoming list
      }
    }

    if (upcomingEventsDescription.startsWith("No upcoming") && upcomingManual.length > 0) {
      upcomingEventsDescription = upcomingManual
        .map(
          (e) =>
            `- ${e.title} (${e.category}, ${e.spoon_cost} spoons at ${new Date(e.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`,
        )
        .join("\n");
    }

    const tierGuidance =
      impactTier === 3
        ? "CRITICAL: This user has a Tier 3 (Severe) disease. Even light activities (>20 min) are moderate risk. Be very cautious. Any activity costing 3+ spoons deserves a warning."
        : impactTier === 2
          ? "This user has a Tier 2 (Moderate) disease. Monitor back-to-back events and anything costing 4+ spoons. Flag clustering of activities."
          : "This user has a Tier 1 (Mild) disease. They still need pacing but can handle more. Flag only high-cost events (6+) or poor recovery days.";

    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      apiKey: groqKey,
    });

    const temperatureNote =
      temperature !== null ? ` | Temperature: ${temperature}°C` : "";

    const response = await model.invoke([
      {
        role: "system",
        content: `You are a chronic illness energy management AI. Respond ONLY with a raw JSON object (no markdown, no code fences, no bold text). The JSON must have exactly these fields:
- "risk_level": "low" or "medium" or "high"
- "label": short status label (e.g. "Crash Risk: High" or "Energy Stable")
- "insight": one plain-text sentence (no markdown formatting)
- "action_label": button text (e.g. "Schedule Rest Block") or "No action needed"
- "action_type": "rest" or "move" or "cancel" or "none"

Rules:
- risk_level "low" = user is pacing well with adequate spoons remaining
- risk_level "medium" = warning signs (low sleep, high pain, busy schedule, near budget limit)
- risk_level "high" = crash likely (spoons nearly depleted, poor recovery)
- If risk is low, action_type must be "none"
- The insight must reference actual numbers from the data and must not invent numbers
- Use Current spoons remaining as the authoritative current value
- If upcoming events are from Google list without explicit spoon costs, do not cite spoon costs for those upcoming events

${tierGuidance}`,
      },
      {
        role: "user",
        content: `User Profile:
- Condition: ${condition}
- Condition tags: ${conditionTags.join(", ") || "None set"}
- Disease severity: Tier ${impactTier} | Activity multiplier: ${multiplier.toFixed(1)}x

Today's Energy State:
- Starting budget: ${startingSpoons} spoons
- Current spoons remaining: ${currentSpoons} spoons
- Spent so far (non-rest): ${spentSoFar} spoons
- Restored so far (rest + caregiver claims): ${restoredSoFar} spoons
- Sleep quality: ${sleepScore}/10
- Pain level: ${painScore}/10
- Weather deduction: ${weatherDeduction} spoons${temperatureNote}

Upcoming Schedule (next 24 hours):
${upcomingEventsDescription}

Provide your single most important insight as JSON.`,
      },
    ]);

    // Parse the response — strip markdown fences and bold markers
    let raw =
      typeof response.content === "string"
        ? response.content
        : String(response.content);
    raw = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/\*\*/g, "")
      .trim();

    const result = JSON.parse(raw);

    // Validate required fields
    const validRisk = ["low", "medium", "high"];
    const validAction = ["rest", "move", "cancel", "none"];
    if (!validRisk.includes(result.risk_level)) result.risk_level = "low";
    if (!validAction.includes(result.action_type)) result.action_type = "none";

    return NextResponse.json({
      risk_level: result.risk_level,
      label: String(result.label || "Energy Insight"),
      insight: String(result.insight || "Check your energy levels."),
      action_label: String(result.action_label || "No action needed"),
      action_type: result.action_type,
    });
  } catch (err) {
    console.error("AI insight error:", err);
    return NextResponse.json(
      { error: "Failed to generate insight" },
      { status: 500 },
    );
  }
}
