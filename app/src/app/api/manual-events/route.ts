import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** GET /api/manual-events?from=YYYY-MM-DD&to=YYYY-MM-DD — list manual events in range */
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const toDate = toParam ? new Date(toParam) : new Date();
    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];
    const fromTime = new Date(fromStr + "T00:00:00.000Z").toISOString();
    const toTime = new Date(toStr + "T23:59:59.999Z").toISOString();

    const { data, error } = await supabase
      .from("manual_events")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", fromTime)
      .lte("start_time", toTime)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Manual events list error:", error);
      return NextResponse.json(
        { error: "Failed to list events" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      events: data ?? [],
      from: fromStr,
      to: toStr,
    });
  } catch (err) {
    console.error("Manual events GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** POST /api/manual-events — create a manual event */
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      spoon_cost,
      category = "moderate",
      start_time,
      end_time,
      notes,
    } = body;

    if (!title || spoon_cost == null || !start_time) {
      return NextResponse.json(
        { error: "Missing required fields: title, spoon_cost, start_time" },
        { status: 400 }
      );
    }

    const cost = Number(spoon_cost);
    if (cost < 1 || cost > 10) {
      return NextResponse.json(
        { error: "spoon_cost must be between 1 and 10" },
        { status: 400 }
      );
    }

    const validCategories = ["rest", "light", "moderate", "heavy"];
    const cat = validCategories.includes(category) ? category : "moderate";

    const { data: profile } = await supabase
      .from("profiles")
      .select("current_multiplier")
      .eq("id", user.id)
      .single();
    const multiplier = Number(profile?.current_multiplier) || 1;
    const adjustedCost = Math.max(1, Math.min(10, Math.round(cost * multiplier)));

    const { data, error } = await supabase
      .from("manual_events")
      .insert({
        user_id: user.id,
        title: String(title).trim(),
        spoon_cost: adjustedCost,
        category: cat,
        start_time: new Date(start_time).toISOString(),
        end_time: end_time ? new Date(end_time).toISOString() : null,
        notes: notes ? String(notes).trim() : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Manual event insert error:", error);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    // Apply manual event impact to today's daily_log so energy display and caregiver view stay in sync
    const today = new Date(start_time).toISOString().split("T")[0];
    const { data: dailyLog } = await supabase
      .from("daily_logs")
      .select("id, starting_spoons, current_spoons")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (dailyLog) {
      const current = dailyLog.current_spoons ?? dailyLog.starting_spoons ?? 0;
      const delta = cat === "rest" ? adjustedCost : -adjustedCost;
      const maxSpoons = 20;
      const newSpoons =
        delta >= 0
          ? Math.min(maxSpoons, current + delta)
          : Math.max(0, current + delta);
      await supabase
        .from("daily_logs")
        .update({ current_spoons: newSpoons })
        .eq("id", dailyLog.id);
    }

    return NextResponse.json({ success: true, event: data });
  } catch (err) {
    console.error("Manual events POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
