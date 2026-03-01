"use client";

import { useState, useEffect, useCallback } from "react";
import { useSpoonStore } from "@/store/useSpoonStore";
import { useSpoonPrediction } from "@/hooks/useSpoonPrediction";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  duration_minutes: number;
  location: string | null;
  is_all_day: boolean;
}

interface ManualEvent {
  id: string;
  title: string;
  spoon_cost: number;
  category: string;
  start_time: string;
  end_time: string | null;
  notes: string | null;
}

interface DayEvents {
  google: CalendarEvent[];
  manual: ManualEvent[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const categoryColors: Record<string, string> = {
  rest: "text-primary",
  light: "text-text-secondary",
  moderate: "text-warning",
  heavy: "text-critical",
};

export default function CalendarView() {
  const profile = useSpoonStore((s) => s.profile);
  const effectiveSpoons = useSpoonStore((s) => s.effectiveSpoons);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDateKey(new Date()),
  );
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [manualEvents, setManualEvents] = useState<ManualEvent[]>([]);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add event form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("moderate");
  const [newTime, setNewTime] = useState("12:00");
  const [addingEvent, setAddingEvent] = useState(false);

  // AI prediction
  const {
    prediction,
    isPredicting,
    overrideMode,
    setOverrideMode,
    overrideCost,
    setOverrideCost,
    finalCost,
    multiplierApplied,
    wouldGoNegative,
    predict,
    reset: resetPrediction,
  } = useSpoonPrediction(effectiveSpoons);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = formatDateKey(new Date());

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const fromStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const toStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const fetchEvents = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const [gcalRes, manualRes] = await Promise.all([
        fetch(`/api/calendar-events?from=${fromStr}&to=${toStr}`),
        fetch(`/api/manual-events?from=${fromStr}&to=${toStr}`),
      ]);

      if (gcalRes.ok) {
        const gcalData = await gcalRes.json();
        setGoogleEvents(gcalData.events ?? []);
        setHasGoogle(gcalData.has_google ?? false);
      }

      if (manualRes.ok) {
        const manualData = await manualRes.json();
        setManualEvents(manualData.events ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, fromStr, toStr]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Group events by date
  const eventsByDate: Record<string, DayEvents> = {};
  for (const e of googleEvents) {
    const key = e.start.split("T")[0];
    if (!eventsByDate[key]) eventsByDate[key] = { google: [], manual: [] };
    eventsByDate[key].google.push(e);
  }
  for (const e of manualEvents) {
    const key = e.start_time.split("T")[0];
    if (!eventsByDate[key]) eventsByDate[key] = { google: [], manual: [] };
    eventsByDate[key].manual.push(e);
  }

  const selectedDayEvents = eventsByDate[selectedDate] ?? {
    google: [],
    manual: [],
  };
  const totalEvents =
    selectedDayEvents.google.length + selectedDayEvents.manual.length;

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToday() {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(formatDateKey(now));
  }

  function handleTitleChange(value: string) {
    setNewTitle(value);
    predict(value, newCategory);
  }

  function handleCategoryChange(value: string) {
    setNewCategory(value);
    if (newTitle.trim().length >= 3) {
      predict(newTitle, value);
    }
  }

  function handleCloseForm() {
    setShowAddForm(false);
    setNewTitle("");
    setNewCategory("moderate");
    setNewTime("12:00");
    resetPrediction();
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAddingEvent(true);

    try {
      const startTime = new Date(`${selectedDate}T${newTime}:00`).toISOString();
      const res = await fetch("/api/manual-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          spoon_cost: finalCost,
          category: newCategory,
          start_time: startTime,
          multiplier_applied: multiplierApplied,
        }),
      });

      if (res.ok) {
        handleCloseForm();
        fetchEvents();
      }
    } catch (err) {
      console.error("Failed to add event:", err);
    } finally {
      setAddingEvent(false);
    }
  }

  // Build calendar grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="glass-card rounded-card p-grid-3 space-y-grid-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold text-text-primary">Calendar</h3>
        {hasGoogle && (
          <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-pill">
            Google Calendar
          </span>
        )}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Previous month"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-data font-medium text-text-primary">
            {monthLabel}
          </span>
          {selectedDate !== today && (
            <button
              onClick={goToday}
              className="text-[11px] text-primary hover:text-primary-light cursor-pointer"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Next month"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-medium text-text-secondary py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day Grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-9" />;
          }
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateKey === today;
          const isSelected = dateKey === selectedDate;
          const dayEvents = eventsByDate[dateKey];
          const eventCount = dayEvents
            ? dayEvents.google.length + dayEvents.manual.length
            : 0;

          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(dateKey)}
              className={`h-9 flex flex-col items-center justify-center rounded-lg text-[13px] transition-colors cursor-pointer relative
                ${isSelected ? "bg-primary text-white" : isToday ? "bg-primary/10 text-primary font-semibold" : "text-text-primary hover:bg-primary-pale/30"}`}
            >
              {day}
              {eventCount > 0 && (
                <div className="flex gap-[2px] absolute bottom-0.5">
                  {eventCount <= 3 ? (
                    Array.from({ length: eventCount }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/80" : "bg-primary"}`}
                      />
                    ))
                  ) : (
                    <div
                      className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/80" : "bg-primary"}`}
                    />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Events */}
      <div className="border-t border-[rgba(255,255,255,0.1)] pt-grid-2 space-y-grid-1">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-text-secondary">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
            {totalEvents > 0 && (
              <span className="text-text-secondary/60">
                {" "}
                &middot; {totalEvents} event{totalEvents !== 1 ? "s" : ""}
              </span>
            )}
          </p>
          <button
            onClick={() =>
              showAddForm ? handleCloseForm() : setShowAddForm(true)
            }
            className="text-[12px] text-primary hover:text-primary-light cursor-pointer flex items-center gap-1"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>

        {/* Add Event Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddEvent}
            className={`bg-surface rounded-lg p-grid-2 space-y-grid-1 border transition-colors ${
              wouldGoNegative && prediction
                ? "border-critical"
                : "border-[rgba(255,255,255,0.1)]"
            }`}
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="What are you doing?"
              className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[13px] text-text-primary placeholder-text-secondary/50 focus:border-primary focus:outline-none"
              required
            />
            <div className="flex gap-2">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1 bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[13px] text-text-primary focus:border-primary focus:outline-none"
              />
              <select
                value={newCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="flex-1 bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg px-2 py-1.5 text-[13px] text-text-primary focus:border-primary focus:outline-none"
              >
                <option value="rest">Rest</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>

            {/* AI Prediction Display */}
            {isPredicting && (
              <div className="space-y-1">
                <p className="text-[11px] text-primary">
                  Calculating impact...
                </p>
                <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/40 rounded-full animate-pulse w-1/2" />
                </div>
              </div>
            )}

            {prediction && !isPredicting && !overrideMode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">
                    Estimated cost:{" "}
                    <span className="font-mono font-semibold text-text-primary">
                      {prediction.finalCost}
                    </span>{" "}
                    spoons
                    {prediction.multiplier > 1 && (
                      <span className="text-text-secondary/60">
                        {" "}
                        ({prediction.baseCost} &times; {prediction.multiplier}x)
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOverrideMode(true)}
                    className="text-[10px] text-text-secondary/60 hover:text-text-secondary cursor-pointer"
                  >
                    Override
                  </button>
                </div>
                <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      wouldGoNegative ? "bg-critical" : "bg-primary"
                    }`}
                    style={{ width: `${(prediction.finalCost / 10) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-text-secondary/80">
                  {prediction.reason}
                </p>
                {prediction.warning && (
                  <p className="text-[11px] text-critical">
                    {prediction.warning}
                  </p>
                )}
              </div>
            )}

            {overrideMode && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">
                    Manual cost:{" "}
                    <span className="font-mono font-semibold text-text-primary">
                      {overrideCost}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOverrideMode(false)}
                    className="text-[10px] text-primary cursor-pointer"
                  >
                    Use AI
                  </button>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={overrideCost}
                  onChange={(e) => setOverrideCost(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addingEvent || (isPredicting && !overrideMode)}
                className="flex-1 py-1.5 rounded-lg bg-primary hover:bg-primary/80 text-background text-[12px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {addingEvent ? "Adding..." : "Add Event"}
              </button>
              <button
                type="button"
                onClick={handleCloseForm}
                className="py-1.5 px-3 rounded-lg text-[12px] text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && (
          <p className="text-[12px] text-text-secondary">Loading events...</p>
        )}

        {!loading && totalEvents === 0 && !showAddForm && (
          <p className="text-[12px] text-text-secondary/60">
            No events scheduled. Tap + Add to log an activity.
          </p>
        )}

        {/* Google Calendar Events */}
        {selectedDayEvents.google.map((event) => (
          <div key={event.id} className="flex items-start gap-2 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-text-primary truncate">
                {event.title}
              </p>
              <p className="text-[11px] text-text-secondary">
                {formatTime(event.start)}
                {event.end ? ` – ${formatTime(event.end)}` : ""}
                {event.location && (
                  <span className="text-text-secondary/60">
                    {" "}
                    &middot; {event.location}
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}

        {/* Manual Events */}
        {selectedDayEvents.manual.map((event) => (
          <div key={event.id} className="flex items-start gap-2 py-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                event.category === "rest"
                  ? "bg-primary"
                  : event.category === "heavy"
                    ? "bg-critical"
                    : event.category === "moderate"
                      ? "bg-warning"
                      : "bg-text-secondary"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-text-primary truncate">
                {event.title}
              </p>
              <p className="text-[11px] text-text-secondary">
                {formatTime(event.start_time)}
                <span
                  className={`ml-1 ${categoryColors[event.category] ?? "text-text-secondary"}`}
                >
                  {event.category} &middot; {event.spoon_cost} spoons
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
