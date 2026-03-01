import { NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
    getCalendarEvents,
    getDemoCalendarEvents,
    CalendarEvent,
} from "@/lib/google-calendar";

const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";

const eventCostSchema = z.object({
    id: z.string(),
    title: z.string(),
    cost: z.number().min(1).max(10),
    reason: z.string(),
    start: z.string(),
    end: z.string(),
    priority: z.enum(["essential", "important", "flexible", "deferrable"]),
});

const scheduleAuditSchema = z.object({
    event_costs: z.array(eventCostSchema),
    total_projected_drain: z.number(),
    crash_probability: z.number().min(0).max(100),
    risk_summary: z.string(),
});

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ token: string }> },
) {
    try {
        const { token } = await params;
        const supabase = createServerSupabaseClient();

        const { data: access, error: accessError } = await supabase
            .from("shared_access")
            .select("owner_id")
            .eq("access_token", token)
            .single();

        if (accessError || !access) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
        }

        const ownerId = access.owner_id as string;

        const [{ data: profile }, { data: dailyLog }] = await Promise.all([
            supabase
                .from("profiles")
                .select("condition_tags, activity_multiplier")
                .eq("id", ownerId)
                .single(),
            supabase
                .from("daily_logs")
                .select("starting_spoons, current_spoons")
                .eq("user_id", ownerId)
                .eq("date", new Date().toISOString().split("T")[0])
                .single(),
        ]);

        const startingSpoons =
            Number(dailyLog?.current_spoons ?? dailyLog?.starting_spoons) || 0;

        const nowIso = new Date().toISOString();
        const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        let events: CalendarEvent[] = [];
        let usingDemo = false;
        let eventSource: "google" | "manual" | "demo" = "manual";

        const adminSupabase = createAdminSupabaseClient();
        if (adminSupabase) {
            const { data: tokenRow } = await adminSupabase
                .from("owner_oauth_tokens")
                .select("google_provider_token")
                .eq("owner_id", ownerId)
                .single();

            const providerToken = tokenRow?.google_provider_token?.trim();
            if (providerToken) {
                try {
                    events = await getCalendarEvents(providerToken);
                    if (events.length > 0) {
                        eventSource = "google";
                    }
                } catch {
                    events = [];
                }
            }
        }

        if (!events.length) {
            const { data: manualEvents } = await supabase
                .from("manual_events")
                .select("id, title, start_time, end_time, category")
                .eq("user_id", ownerId)
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

                    return {
                        id: String(e.id),
                        title: String(e.title),
                        start: startIso,
                        end: endIso,
                        duration_minutes: Math.max(
                            15,
                            Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60)),
                        ),
                        location: null,
                        is_all_day: false,
                    } satisfies CalendarEvent;
                });
                eventSource = "manual";
            } else {
                events = getDemoCalendarEvents();
                usingDemo = true;
                eventSource = "demo";
            }
        }

        if (!events.length) {
            return NextResponse.json({
                success: true,
                audit: null,
                using_demo: usingDemo,
                starting_spoons: startingSpoons,
            });
        }

        const parser = StructuredOutputParser.fromZodSchema(scheduleAuditSchema);
        const prompt = ChatPromptTemplate.fromMessages([
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

        let audit: z.infer<typeof scheduleAuditSchema>;

        const groqKey = process.env.GROQ_API_KEY?.trim();
        if (!groqKey || groqKey.length < 20) {
            const fallbackEventCosts = events.map((event) => {
                const baseCost = Math.max(1, Math.min(10, Math.round(event.duration_minutes / 30) + 1));
                return {
                    id: event.id,
                    title: event.title,
                    cost: baseCost,
                    reason: "Fallback estimate based on event duration.",
                    start: event.start,
                    end: event.end,
                    priority: baseCost >= 6 ? "essential" : baseCost >= 4 ? "important" : "flexible",
                } as z.infer<typeof eventCostSchema>;
            });

            const fallbackTotal = fallbackEventCosts.reduce((sum, event) => sum + event.cost, 0);
            audit = {
                event_costs: fallbackEventCosts,
                total_projected_drain: fallbackTotal,
                crash_probability: Math.min(100, Math.round((fallbackTotal / Math.max(1, startingSpoons)) * 75)),
                risk_summary:
                    fallbackTotal > startingSpoons
                        ? "Projected drain exceeds available spoons."
                        : "Projected drain appears manageable within current spoons.",
            };
        } else {
            const model = new ChatGroq({
                model: GROQ_MODEL,
                temperature: 0,
                apiKey: groqKey,
            });

            const chain = prompt.pipe(model).pipe(parser);
            audit = await chain.invoke({
                condition_tags: (profile?.condition_tags || []).join(", ") || "None specified",
                starting_spoons: String(Math.max(1, startingSpoons)),
                events: JSON.stringify(
                    events.map((e) => ({
                        id: e.id,
                        title: e.title,
                        start: e.start,
                        end: e.end,
                        duration_minutes: e.duration_minutes,
                        location: e.location || "Virtual/Remote",
                        is_all_day: e.is_all_day,
                    })),
                    null,
                    2,
                ),
                format_instructions: parser.getFormatInstructions(),
            });
        }

        const activityMultiplier = Number(profile?.activity_multiplier) || 1.0;
        const adjustedEventCosts = audit.event_costs.map((event) => ({
            ...event,
            cost: Math.max(1, Math.min(10, Math.round(event.cost * activityMultiplier))),
        }));
        const adjustedTotal = adjustedEventCosts.reduce((sum, event) => sum + event.cost, 0);
        const adjustedCrash = Math.min(
            100,
            Math.round((adjustedTotal / Math.max(1, startingSpoons)) * 75),
        );

        return NextResponse.json({
            success: true,
            audit: {
                ...audit,
                event_costs: adjustedEventCosts,
                total_projected_drain: adjustedTotal,
                crash_probability: adjustedCrash,
            },
            event_source: eventSource,
            using_demo: usingDemo,
            starting_spoons: startingSpoons,
        });
    } catch (err) {
        console.error("Caregiver forecast error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
