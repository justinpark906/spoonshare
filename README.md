# SpoonShare

**AI-driven energy management for rare and chronic illness** — turning the Spoon Theory into a predictive, data-backed tool with a shareable clinical report.

---

## What It Does

- **Personalized Spoon Budget** — HPO phenotype sliders → AI-derived energy cost multiplier.
- **Morning Pre-Flight** — Sleep, pain, optional wearable → daily budget with weather deductions (barometric pressure, cold + chronic pain).
- **Schedule Audit** — LangChain analyzes Google Calendar (or demo events), assigns spoon costs, predicts crashes, suggests rest blocks.
- **Brain Fog UI** — Interface blurs and desaturates as energy drops; “Clear My Fog” restores spoons.
- **Caregiver Sync** — Share a link; caregivers see live energy and can “claim” tasks to give spoons back.
- **Clinical Brief (Phase 5)** — Weekly data → LangChain RAG + HPO mapping → professional, one-page report. Share 24h link or download PDF for your doctor.

---

## Quick Start

### 1. Install and run

```bash
cd app
npm install
npm run dev
```

Open **http://localhost:3000**.

### 2. Environment variables

Create `app/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENWEATHERMAP_API_KEY=your-key   # optional; uses demo weather if missing
OPENAI_API_KEY=your-key          # for LangChain (profile AI, schedule audit, report)
```

### 3. Database (Supabase)

Run the SQL migrations in the Supabase SQL Editor, in order:

1. `app/supabase-schema.sql` — profiles
2. `app/supabase-schema-phase2.sql` — weather_logs, daily_logs
3. `app/supabase-schema-phase4.sql` — shared_access, daily_logs columns, realtime
4. `app/supabase-schema-phase5.sql` — user_notes, reports
5. `app/supabase-schema-phase6-biometrics.sql` — biometrics, manual_events, hrv_baseline (profiles), hrv_deduction (daily_logs)

### 4. Disable email confirmation (optional)

Supabase requires new users to confirm their email by default. For local dev or hackathons you can turn this off:

1. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers** → **Email**.
2. Turn **off** “Confirm email”.
3. New signups can use the app immediately without clicking a link.

(Re-enable for production so only real addresses can sign in.)

### 5. Deploy to Vercel

1. Push your repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Set the **Root Directory** to `app` (Settings → General → Root Directory). That way Vercel builds from the Next.js app and detects the framework correctly.
3. In **Settings → Framework Settings**:
   - **Framework Preset:** choose **Next.js** (if it shows "Other", change it so Vercel doesn’t use the static "public" output).
   - **Output Directory:** turn **Override** **ON** and leave the value **empty** (delete any `public` or `.` so the field is blank). Next.js uses `.next`; Vercel handles it when the preset is Next.js.
4. In **Settings → Environment Variables**, add (and enable for **Build** and **Production**):
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `OPENAI_API_KEY` = optional; for AI features
   - `OPENWEATHERMAP_API_KEY` = optional; for weather deductions
5. Redeploy.

---

## How to Navigate the App

| Route | Purpose |
|-------|--------|
| **/login** | Sign in (email/password or Google with Calendar). |
| **/onboarding** | First-time: rate 5 HPO phenotypes → AI sets multiplier & condition tags. |
| **/** (dashboard) | After morning check-in: battery, schedule audit, weather, Clinical Brief, Caregiver Sync. “Generate Report” is at the bottom. |
| **/report** | Generate Clinical Brief from last 7 days → preview, “Share with Doctor” (24h link), “Download PDF”. |
| **/report/shared/[token]** | Public link for doctor/caregiver to view report (no login). |
| **/status/[token]** | Caregiver view: live spoons, claim tasks to restore spoons. |

### Typical user flow

1. **Login** → **Onboarding** (one time) → **Dashboard**.
2. Each day: **Morning Pre-Flight** (sleep/pain) → **Calculate Today’s Spoons**.
3. **Analyze My Schedule** (optional) → see crash risk and optimized plan.
4. Use **Caregiver Sync** to create a link; share with family/caregivers.
5. When ready: **Generate Report** (bottom of dashboard) → **/report** → generate → Share link or Download PDF for the doctor.

---

## Project layout (app)

```
app/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard
│   │   ├── login/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── report/page.tsx       # Clinical Brief generator
│   │   ├── report/shared/[token]/page.tsx  # Public report view
│   │   ├── status/[token]/page.tsx        # Caregiver view
│   │   ├── auth/callback/route.ts
│   │   └── api/
│   │       ├── morning-audit/    # Daily budget
│   │       ├── schedule-audit/    # Calendar + LangChain
│   │       ├── profile-ai/       # Onboarding multiplier
│   │       ├── generate-report/  # Phase 5 RAG report
│   │       └── claim-task/       # Caregiver claim
│   ├── components/
│   │   ├── FogWrapper.tsx, FogProvider.tsx, ClearFogButton.tsx  # Brain Fog UI
│   │   ├── ReportView.tsx        # Report preview + PDF + share
│   │   ├── CaregiverShare.tsx
│   │   ├── DailyForecast.tsx     # Schedule audit UI
│   │   └── ...
│   ├── lib/
│   │   ├── budget.ts, weather.ts, google-calendar.ts
│   │   ├── weekly-summary.ts     # 7-day aggregation for report
│   │   ├── hpo-mapping.ts        # HPO reference for RAG
│   │   └── phenotypes.ts
│   └── store/useSpoonStore.ts
├── supabase-schema*.sql
└── package.json
```

---

## HackRare

Built for **HackRare**. Phase 5 delivers the “proof”: a professional, HPO-mapped report that helps patients show doctors the link between environment, activity, and symptom flares.
