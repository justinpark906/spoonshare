import { NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getCalendarEvents,
  CalendarEvent,
} from "@/lib/google-calendar";

const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";

// --- Zod schemas for structured AI output ---

const eventCostSchema = z.object({
  id: z.string().describe("The calendar event ID"),
  title: z.string().describe("Event title"),
  cost: z
    .number()
    .min(1)
    .max(10)
    .describe("Spoon cost for this event (1-10)"),
  reason: z
    .string()
    .describe("Brief explanation of why this cost was assigned"),
  start: z.string().describe("Event start time (ISO)"),
  end: z.string().describe("Event end time (ISO)"),
  priority: z
    .enum(["essential", "important", "flexible", "deferrable"])
    .describe("Priority classification for optimization"),
});

const scheduleAuditSchema = z.object({
  event_costs: z.array(eventCostSchema),
  total_projected_drain: z
    .number()
    .describe("Total spoons needed for all events combined"),
  crash_probability: z
    .number()
    .min(0)
    .max(100)
    .describe("Probability of energy crash as a percentage (0-100)"),
  risk_summary: z
    .string()
    .describe(
      "One-sentence summary of the day's energy outlook"
    ),
});

const optimizedScheduleSchema = z.object({
  optimized_events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      action: z
        .enum(["keep", "move", "cancel_suggest", "add_rest"])
        .describe("What to do with this event"),
      original_time: z.string().describe("Original start time"),
      suggested_time: z
        .string()
        .nullable()
        .describe("Suggested new start time, or null if unchanged"),
      note: z.string().describe("Explanation for the suggestion"),
    })
  ),
  rest_blocks: z.array(
    z.object({
      after_event_id: z.string(),
      start: z.string(),
      duration_minutes: z.number(),
      reason: z.string(),
    })
  ),
  new_total_drain: z
    .number()
    .describe("New projected drain after optimization"),
  new_crash_probability: z
    .number()
    .min(0)
    .max(100)
    .describe("New crash probability after optimization"),
  optimization_summary: z
    .string()
    .describe("Brief explanation of changes made"),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // 3. Get today's starting spoons
    const { starting_spoons: startingSpoons } = await request.json();

    if (!startingSpoons) {
      return NextResponse.json(
        { error: "Missing starting_spoons" },
        { status: 400 }
      );
    }

    // 4. Fetch events for next 24h — Google first, then user's non-rest manual events
    let events: CalendarEvent[];
    const usingDemo = false;
    const nowIso = new Date().toISOString();
    const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

    if (providerToken) {
      try {
        events = await getCalendarEvents(providerToken);
      } catch {
        events = [];
      }
    } else {
      events = [];
    }

    if (!events || events.length === 0) {
      const { data: manualEvents } = await supabase
        .from("manual_events")
        .select("id, title, start_time, end_time, category, spoon_cost")
        .eq("user_id", user.id)
        .neq("category", "rest")
        .gte("start_time", nowIso)
        .lte("start_time", tomorrowIso)
        .order("start_time", { ascending: true });

      if (manualEvents && manualEvents.length > 0) {
        events = manualEvents.map((e) => {
          const startIso = new Date(e.start_time).toISOString();
          const endIso = e.end_time
            ? new Date(e.end_time).toISOString()
            : new Date(new Date(e.start_time).getTime() + 30 * 60 * 1000).toISOString();
          const durationMinutes = Math.max(
            15,
            Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60)),
          );

          return {
            id: String(e.id),
            title: String(e.title),
            start: startIso,
            end: endIso,
            duration_minutes: durationMinutes,
            location: null,
            is_all_day: false,
          } as CalendarEvent;
        });
      } else {
        events = [];
      }
    }

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        audit: null,
        optimization: null,
        message: "No events found in the next 24 hours",
        using_demo: usingDemo,
      });
    }

    // 5. Format events for AI analysis
    const conditionTags: string[] = profile.condition_tags ?? [];
    const eventsForAI = events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      duration_minutes: e.duration_minutes,
      location: e.location || "Virtual/Remote",
      is_all_day: e.is_all_day,
    }));

    // 6. LangChain — Pacing Specialist Audit
    const auditParser = StructuredOutputParser.fromZodSchema(scheduleAuditSchema);

    const auditPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a Chronic Illness Pacing Consultant specializing in energy management using Spoon Theory.

The patient has these clinical condition tags: {condition_tags}
Their starting energy budget today is: {starting_spoons} spoons

Analyze each calendar event and assign a "Spoon Cost" (1-10) based on these rules:

**Base cost by type:**
- Quick virtual check-in/standup: 1-2 spoons
- Regular meeting (virtual): 2-3 spoons
- Extended meeting (>60min): 3-5 spoons
- Doctor/medical appointment: 4-6 spoons
- Physical activity (gym, PT, exercise): 5-8 spoons
- Social event/gathering: 3-6 spoons
- Errands (grocery, shopping): 3-5 spoons

**Modifiers:**
- Duration: +1 spoon per 30 minutes beyond the first 30
- In-person with location (travel fatigue): +2 spoons
- Back-to-back events (no gap): +1 spoon to the second event

**Condition-specific adjustments:**
- If patient has "Dysautonomia Risk": standing/walking events cost +1
- If patient has "EDS Spectrum": physical events cost +2
- If patient has "ME/CFS Pattern": ALL events cost +1 (post-exertional malaise risk)
- If patient has "Sensory Processing Concern": loud/stimulating environments +1

**Priority classification:**
- essential: medical appointments, critical work meetings
- important: regular work tasks, necessary errands
- flexible: social events, non-urgent tasks
- deferrable: optional activities that could be postponed

Calculate crash_probability as: min(100, (total_drain / starting_spoons) * 75)

{format_instructions}`,
      ],
      [
        "human",
        `Here are my calendar events for the next 24 hours:

{events}

Please analyze each event and provide the structured output.`,
      ],
    ]);

    const model = new ChatGroq({
      model: GROQ_MODEL,
      temperature: 0.2,
      apiKey: process.env.GROQ_API_KEY,
    });

    const auditChain = auditPrompt.pipe(model).pipe(auditParser);

    const auditResult = await auditChain.invoke({
      condition_tags: conditionTags.join(", ") || "None specified",
      starting_spoons: startingSpoons.toString(),
      events: JSON.stringify(eventsForAI, null, 2),
      format_instructions: auditParser.getFormatInstructions(),
    });

    const activityMultiplier = Number(profile.activity_multiplier) ?? 1.0;
    const multiplier = activityMultiplier;
    const adjustedEventCosts = auditResult.event_costs.map((event) => ({
      ...event,
      cost: Math.max(1, Math.min(10, Math.round(event.cost * multiplier))),
    }));
    const adjustedTotalDrain = adjustedEventCosts.reduce(
      (sum, event) => sum + event.cost,
      0,
    );
    const adjustedCrashProbability = Math.min(
      100,
      (adjustedTotalDrain / startingSpoons) * 75,
    );
    const adjustedAuditResult = {
      ...auditResult,
      event_costs: adjustedEventCosts,
      total_projected_drain: adjustedTotalDrain,
      crash_probability: Math.round(adjustedCrashProbability),
    };

    // 7. Crash Risk — determine if optimization is needed
    let optimization = null;
    const willCrash = adjustedAuditResult.total_projected_drain > startingSpoons;

    if (willCrash) {
      // Calculate crash time — find the event where cumulative cost exceeds budget
      let cumulative = 0;
      let crashEventId = "";
      let crashTime = "";

      for (const ec of adjustedAuditResult.event_costs) {
        cumulative += ec.cost;
        if (cumulative > startingSpoons) {
          crashEventId = ec.id;
          crashTime = ec.start;
          break;
        }
      }

      // 8. LangChain — Optimizer
      const optimizerParser =
        StructuredOutputParser.fromZodSchema(optimizedScheduleSchema);

      const optimizerPrompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `You are a Chronic Illness Schedule Optimizer. A patient is predicted to crash (run out of energy) today.

**Patient Info:**
- Condition tags: {condition_tags}
- Starting spoons: {starting_spoons}
- Total projected drain: {total_drain}
- Predicted crash time: {crash_time}

**Your optimization rules:**
1. NEVER move or cancel "essential" priority events
2. Identify the lowest-priority event and suggest moving/canceling it
3. After ANY event costing > 4 spoons, insert a 30-minute "Rest Block" (Spoon Recharge)
4. Try to spread high-cost events apart (avoid back-to-back)
5. The goal is to bring total_drain <= starting_spoons, or as close as possible
6. Rest blocks cost 0 spoons — they are recovery time that PREVENTS future drain

Be empathetic. These are real patients managing real limitations.

{format_instructions}`,
        ],
        [
          "human",
          `Here is the schedule audit:

{audit_result}

The patient will crash at event "{crash_event_id}" around {crash_time}.

Please optimize the schedule to prevent the crash.`,
        ],
      ]);

      const optimizerChain = optimizerPrompt.pipe(model).pipe(optimizerParser);

      optimization = await optimizerChain.invoke({
        condition_tags: conditionTags.join(", ") || "None specified",
        starting_spoons: startingSpoons.toString(),
        total_drain: adjustedAuditResult.total_projected_drain.toString(),
        crash_time: crashTime,
        audit_result: JSON.stringify(adjustedAuditResult, null, 2),
        crash_event_id: crashEventId,
        format_instructions: optimizerParser.getFormatInstructions(),
      });
    }

    return NextResponse.json({
      success: true,
      audit: adjustedAuditResult,
      optimization,
      crash_predicted: willCrash,
      using_demo: usingDemo,
    });
  } catch (err) {
    console.error("Schedule audit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
