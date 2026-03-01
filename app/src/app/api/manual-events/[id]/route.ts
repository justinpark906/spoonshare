import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** DELETE /api/manual-events/[id] — delete a manual event */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch event first so we can reverse its spoon impact on daily_log
    const { data: event, error: fetchError } = await supabase
      .from("manual_events")
      .select("spoon_cost, start_time, category")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("manual_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Manual event delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete event" },
        { status: 500 }
      );
    }

    // Reverse event impact in today's daily_log so energy display and caregiver view stay in sync
    const spoonCost = Number(event.spoon_cost) || 0;
    const today = new Date(event.start_time).toISOString().split("T")[0];
    const { data: dailyLog } = await supabase
      .from("daily_logs")
      .select("id, starting_spoons, current_spoons")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (dailyLog && spoonCost > 0) {
      const current = dailyLog.current_spoons ?? dailyLog.starting_spoons ?? 0;
      const delta = event.category === "rest" ? -spoonCost : spoonCost;
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Manual events DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
