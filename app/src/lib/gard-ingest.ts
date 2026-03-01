/**
 * GARD (Genetic and Rare Diseases) CSV ingestion for SpoonShare.
 * Parses disease_name + symptoms (HPO-style, semicolon-separated), assigns impact_tier, upserts to Supabase.
 */

import Papa from "papaparse";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";

export interface GardRow {
  disease_name: string;
  symptoms: string;
  url?: string;
}

const impactTierSchema = z.object({
  tiers: z.array(
    z.object({
      index: z.number(),
      impact_tier: z
        .number()
        .min(1)
        .max(3)
        .describe("1=Mild (1.1x), 2=Moderate (1.5x), 3=Severe (2.0x+)"),
    }),
  ),
});

/** Extract HPO-style terms from the symptoms string (semicolon-separated). */
export function extractHpoTerms(symptomsRaw: string): string[] {
  if (
    !symptomsRaw ||
    symptomsRaw.trim() === "" ||
    /no symptoms listed/i.test(symptomsRaw)
  ) {
    return [];
  }
  return symptomsRaw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Heuristic impact_tier when no OpenAI key: based on symptom count and energy-related keywords. */
function heuristicImpactTier(row: GardRow): number {
  const terms = extractHpoTerms(row.symptoms);
  const text = (row.symptoms || "").toLowerCase();
  const hasFatigue =
    /fatigue|malaise|exertional|chronic fatigue|myalgia|weakness|lethargy|tiredness/i.test(
      text,
    );
  const hasSevere =
    /encephalopathy|cardiomyopathy|respiratory failure|seizure|developmental delay|intellectual disability/i.test(
      text,
    );
  if (terms.length === 0) return 1;
  if (hasSevere && hasFatigue) return 3;
  if (hasFatigue || hasSevere || terms.length > 20) return 2;
  return 1;
}

/** Map impact_tier (1,2,3) to activity_multiplier value. */
export function tierToMultiplier(tier: number): number {
  switch (tier) {
    case 1:
      return 1.1;
    case 2:
      return 1.5;
    case 3:
      return 2.0;
    default:
      return 1.5;
  }
}

/** Parse CSV file and return rows. */
export function parseGardCsv(csvPath: string): GardRow[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: GardRow[] = [];
  for (const row of parsed.data) {
    const name = row["disease_name"] ?? row["Disease Name"] ?? "";
    const symptoms = row["symptoms"] ?? row["Symptoms"] ?? "";
    if (name)
      rows.push({
        disease_name: name,
        symptoms,
        url: row["url"] ?? row["URL"],
      });
  }
  return rows;
}

const BATCH_SIZE = 30;

/** Assign impact_tier for a batch of diseases using LangChain (optional). */
async function assignImpactTiersBatch(
  batch: GardRow[],
  openAiKey: string,
): Promise<number[]> {
  const parser = StructuredOutputParser.fromZodSchema(impactTierSchema);
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a clinical assistant. For each rare disease, assign an impact_tier for daily physical energy impact:
- 1 = Mild (e.g. localized chronic pain, minor symptoms): 1.1x multiplier
- 2 = Moderate (e.g. systemic fatigue, multiple symptoms): 1.5x multiplier
- 3 = Severe (e.g. mitochondrial disease, severe ME/CFS, major neurological/cardiac): 2.0x+ multiplier

Consider: fatigue, malaise, exertion intolerance, pain, cognitive load, mobility.

{format_instructions}`,
    ],
    [
      "human",
      `Diseases and their symptoms (one per line, index 0-based):

{disease_list}`,
    ],
  ]);
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.2,
    apiKey: openAiKey,
  });
  const chain = prompt.pipe(model).pipe(parser);
  const diseaseList = batch
    .map(
      (r, i) =>
        `[${i}] ${r.disease_name}\nSymptoms: ${(r.symptoms || "").slice(0, 400)}`,
    )
    .join("\n\n");
  const result = await chain.invoke({
    disease_list: diseaseList,
    format_instructions: parser.getFormatInstructions(),
  });
  const tierMap = new Map(result.tiers.map((t) => [t.index, t.impact_tier]));
  return batch.map((_, i) => tierMap.get(i) ?? 2);
}

/** Ingest GARD CSV into Supabase diseases table. */
export async function syncDiseaseDatabase(options: {
  csvPath: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  openAiKey?: string | null;
  batchSize?: number;
}): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const {
    csvPath,
    supabaseUrl,
    supabaseServiceKey,
    openAiKey,
    batchSize = BATCH_SIZE,
  } = options;
  const supabase: SupabaseClient = createClient(
    supabaseUrl,
    supabaseServiceKey,
  );
  const rows = parseGardCsv(csvPath);
  const errors: string[] = [];
  let inserted = 0;
  const updated = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    let tiers: number[];
    if (openAiKey && openAiKey.startsWith("sk-")) {
      try {
        tiers = await assignImpactTiersBatch(batch, openAiKey);
      } catch (e) {
        errors.push(
          `Batch ${i}: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
        tiers = batch.map((r) => heuristicImpactTier(r));
      }
    } else {
      tiers = batch.map((r) => heuristicImpactTier(r));
    }

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const hpoTerms = extractHpoTerms(row.symptoms);
      const impactTier = tiers[j] ?? 2;
      const { error } = await supabase.from("diseases").upsert(
        {
          name: row.disease_name,
          symptoms_raw: row.symptoms || null,
          hpo_terms: hpoTerms,
          impact_tier: impactTier,
          gard_url: row.url || null,
        },
        { onConflict: "name", ignoreDuplicates: false },
      );
      if (error) {
        errors.push(`${row.disease_name}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }

  return { inserted, updated, errors };
}
