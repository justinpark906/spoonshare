import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && user) {
      // If user has completed onboarding (symptom_data), go to dashboard
      const { data: profile } = await supabase
        .from("profiles")
        .select("symptom_data")
        .eq("id", user.id)
        .single();
      const hasOnboarding =
        profile?.symptom_data && Object.keys(profile.symptom_data).length > 0;
      return NextResponse.redirect(
        hasOnboarding ? `${origin}/dashboard` : `${origin}/onboarding`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
