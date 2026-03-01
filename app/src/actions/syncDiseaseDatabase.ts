"use server";

import * as path from "path";
import * as fs from "fs";
import { syncDiseaseDatabase } from "@/lib/gard-ingest";

/**
 * Server action: sync GARD CSV into Supabase diseases table.
 * Call from an admin page or one-off setup.
 * Requires SUPABASE_SERVICE_ROLE_KEY and CSV at app/public/gard_symptoms_list.csv or ../../gard_symptoms_list.csv.
 */
export async function syncDiseaseDatabaseAction(): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  errors?: string[];
  error?: string;
}> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return {
        success: false,
        error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      };
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
      return {
        success: false,
        error: `GARD CSV not found. Tried: ${csvPath}, ${fallback}. Place gard_symptoms_list.csv in app/public/ or set GARD_CSV_PATH.`,
      };
    }

    const openAiKey = process.env.OPENAI_API_KEY ?? null;
    const result = await syncDiseaseDatabase({
      csvPath: resolved,
      supabaseUrl,
      supabaseServiceKey: serviceKey,
      openAiKey,
      batchSize: 25,
    });

    return {
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      errors: result.errors.length > 0 ? result.errors.slice(0, 30) : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}
