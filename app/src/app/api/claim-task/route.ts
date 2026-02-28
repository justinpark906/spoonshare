import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { access_token, event_id, event_title, spoon_cost, caregiver_name } =
      await request.json();

    if (!access_token || !event_id || !spoon_cost) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // 1. Verify the access token and get the owner
    const { data: sharedAccess, error: tokenError } = await supabase
      .from("shared_access")
      .select("owner_id, label")
      .eq("access_token", access_token)
      .single();

    if (tokenError || !sharedAccess) {
      return NextResponse.json(
        { error: "Invalid access token" },
        { status: 403 }
      );
    }

    const ownerId = sharedAccess.owner_id;
    const today = new Date().toISOString().split("T")[0];

    // 2. Get today's daily log
    const { data: dailyLog, error: logError } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", ownerId)
      .eq("date", today)
      .single();

    if (logError || !dailyLog) {
      return NextResponse.json(
        { error: "No daily log found for today" },
        { status: 404 }
      );
    }

    // 3. Add the claimed task and refund spoons
    const existingClaims = dailyLog.claimed_tasks || [];
    const newClaim = {
      event_id,
      event_title: event_title || "Unknown task",
      spoon_cost,
      caregiver_name: caregiver_name || sharedAccess.label,
      claimed_at: new Date().toISOString(),
    };

    const newCurrentSpoons =
      (dailyLog.current_spoons ?? dailyLog.starting_spoons) +
      Math.round(spoon_cost);

    const { error: updateError } = await supabase
      .from("daily_logs")
      .update({
        claimed_tasks: [...existingClaims, newClaim],
        current_spoons: newCurrentSpoons,
      })
      .eq("id", dailyLog.id);

    if (updateError) {
      console.error("Claim task update error:", updateError);
      return NextResponse.json(
        { error: "Failed to claim task" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${caregiver_name || sharedAccess.label} claimed "${event_title}". +${Math.round(spoon_cost)} spoons restored.`,
      new_spoons: newCurrentSpoons,
    });
  } catch (err) {
    console.error("Claim task error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
