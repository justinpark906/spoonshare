/**
 * Google Calendar Integration for SpoonShare
 *
 * Uses the user's Google OAuth provider_token from Supabase
 * to fetch their next 24 hours of calendar events.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string;
  duration_minutes: number;
  location: string | null;
  is_all_day: boolean;
}

const GCAL_API = "https://www.googleapis.com/calendar/v3";

/**
 * Fetch the next 24 hours of events using the user's Google OAuth token.
 */
export async function getCalendarEvents(
  providerToken: string
): Promise<CalendarEvent[]> {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: tomorrow.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const res = await fetch(
    `${GCAL_API}/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${providerToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("Google Calendar API error:", res.status, errorBody);
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  const data = await res.json();

  return (data.items || []).map((event: Record<string, unknown>) => {
    const startObj = event.start as Record<string, string> | undefined;
    const endObj = event.end as Record<string, string> | undefined;
    const isAllDay = !!startObj?.date;

    const startTime = startObj?.dateTime || startObj?.date || "";
    const endTime = endObj?.dateTime || endObj?.date || "";

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    return {
      id: event.id as string,
      title: (event.summary as string) || "Untitled Event",
      start: startTime,
      end: endTime,
      duration_minutes: isAllDay ? 480 : durationMinutes,
      location: (event.location as string) || null,
      is_all_day: isAllDay,
    };
  });
}

/**
 * Generate demo calendar events for testing without Google OAuth.
 */
export function getDemoCalendarEvents(): CalendarEvent[] {
  const now = new Date();
  const makeTime = (hoursFromNow: number) =>
    new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000).toISOString();

  return [
    {
      id: "demo-1",
      title: "Morning Stand-up Meeting",
      start: makeTime(1),
      end: makeTime(1.5),
      duration_minutes: 30,
      location: null,
      is_all_day: false,
    },
    {
      id: "demo-2",
      title: "Physical Therapy Session",
      start: makeTime(3),
      end: makeTime(4),
      duration_minutes: 60,
      location: "PT Clinic, 123 Health St",
      is_all_day: false,
    },
    {
      id: "demo-3",
      title: "Grocery Shopping",
      start: makeTime(5.5),
      end: makeTime(6.5),
      duration_minutes: 60,
      location: "Whole Foods Market",
      is_all_day: false,
    },
    {
      id: "demo-4",
      title: "Team Project Meeting",
      start: makeTime(8),
      end: makeTime(9.5),
      duration_minutes: 90,
      location: null,
      is_all_day: false,
    },
    {
      id: "demo-5",
      title: "Doctor Appointment - Rheumatology",
      start: makeTime(11),
      end: makeTime(12),
      duration_minutes: 60,
      location: "Medical Center, Suite 400",
      is_all_day: false,
    },
    {
      id: "demo-6",
      title: "Dinner with Family",
      start: makeTime(14),
      end: makeTime(16),
      duration_minutes: 120,
      location: "Mom's House",
      is_all_day: false,
    },
  ];
}
