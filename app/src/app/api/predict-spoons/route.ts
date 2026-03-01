import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSpoonPrediction } from "@/lib/spoon-predictor";

/**
 * POST /api/predict-spoons
 * AI-powered spoon cost prediction for a task.
 * Input: { title: string, category?: string, currentSpoons: number }
 * Output: { cost, reason, warning }
 */
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
    const { title, category, currentSpoons } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "condition_tags, activity_multiplier, impact_tier, identified_condition",
      )
      .eq("id", user.id)
      .single();

    const prediction = await getSpoonPrediction({
      title: title.trim(),
      category: category || undefined,
      currentSpoons: typeof currentSpoons === "number" ? currentSpoons : 10,
      conditionTags: profile?.condition_tags ?? [],
      activityMultiplier: Number(profile?.activity_multiplier) || 1,
      impactTier: profile?.impact_tier ?? null,
      identifiedCondition: profile?.identified_condition ?? null,
    });

    return NextResponse.json({
      success: true,
      ...prediction,
    });
  } catch (err) {
    console.error("Predict spoons error:", err);
    return NextResponse.json(
      { error: "Prediction failed" },
      { status: 500 },
    );
  }
}
