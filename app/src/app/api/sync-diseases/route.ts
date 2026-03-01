import { NextResponse } from "next/server";
import * as path from "path";
import * as fs from "fs";
import {
  syncDiseaseDatabase,
} from "@/lib/gard-ingest";

/**
 * POST /api/sync-diseases
 * Ingests GARD CSV into Supabase diseases table.
 * Requires: SUPABASE_SERVICE_ROLE_KEY (or runs with anon and RLS).
 * CSV path: GARD_CSV_PATH env, or ../../gard_symptoms_list.csv, or public/gard_symptoms_list.csv.
 */
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const csvPath =
      process.env.GARD_CSV_PATH ||
      path.join(process.cwd(), "public", "gard_symptoms_list.csv");
    const fallback = path.join(process.cwd(), "..", "gard_symptoms_list.csv");

    let resolved = csvPath;
    if (!fs.existsSync(csvPath) && fs.existsSync(fallback)) {
      resolved = fallback;
    }
    if (!fs.existsSync(resolved)) {
      return NextResponse.json(
        {
          error: "GARD CSV not found",
          tried: [csvPath, fallback],
          hint: "Place gard_symptoms_list.csv in app/public/ or set GARD_CSV_PATH",
        },
        { status: 404 }
      );
    }

    const openAiKey = process.env.OPENAI_API_KEY ?? null;
    const result = await syncDiseaseDatabase({
      csvPath: resolved,
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      openAiKey,
      batchSize: 25,
    });

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      errors: result.errors.slice(0, 20),
    });
  } catch (err) {
    console.error("Sync diseases error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}