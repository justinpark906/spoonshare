import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCalendarEvents } from "@/lib/google-calendar";

/**
 * GET /api/calendar-events?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns Google Calendar events for the date range if connected, otherwise empty array.
 */
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

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: "Missing required params: from, to" },
        { status: 400 },
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

    if (!providerToken) {
      return NextResponse.json({
        success: true,
        events: [],
        has_google: false,
      });
    }

    try {
      const events = await getCalendarEvents(providerToken);
      const from = new Date(fromParam + "T00:00:00.000Z").getTime();
      const to = new Date(toParam + "T23:59:59.999Z").getTime();

      const filtered = events.filter((e) => {
        const start = new Date(e.start).getTime();
        return start >= from && start <= to;
      });

      return NextResponse.json({
        success: true,
        events: filtered,
        has_google: true,
      });
    } catch {
      return NextResponse.json({
        success: true,
        events: [],
        has_google: false,
      });
    }
  } catch (err) {
    console.error("Calendar events error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
