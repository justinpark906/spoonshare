/**
 * Match user symptom tags (from onboarding) to GARD diseases by HPO term overlap.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { tierToMultiplier } from "./gard-ingest";
import { PHENOTYPES } from "./phenotypes";

export interface MatchedDisease {
  id: string;
  name: string;
  impact_tier: number;
  activity_multiplier: number;
}

/**
 * Build a list of symptom labels from onboarding: condition_tags + phenotype names for high scores.
 */
export function userSymptomLabels(
  conditionTags: string[],
  scores: Record<string, number>,
  scoreThreshold: number = 5
): string[] {
  const labels = new Set<string>();
  conditionTags.forEach((t) => labels.add(t.trim()));

  PHENOTYPES.forEach((p) => {
    const score = scores[p.id];
    if (typeof score === "number" && score >= scoreThreshold) {
      labels.add(p.name);
      labels.add(p.name.toLowerCase());
    }
  });

  return Array.from(labels);
}

/**
 * Find the best matching disease from the diseases table by HPO term / label overlap.
 * Returns the disease with the most overlapping hpo_terms, or null if none.
 */
export async function findBestMatchingDisease(
  supabase: SupabaseClient,
  userLabels: string[]
): Promise<MatchedDisease | null> {
  if (userLabels.length === 0) return null;

  const { data: diseases, error } = await supabase
    .from("diseases")
    .select("id, name, hpo_terms, impact_tier");

  if (error || !diseases?.length) return null;

  const normalizedLabels = userLabels.map((l) => l.trim().toLowerCase());
  let best: { id: string; name: string; impact_tier: number; overlap: number } | null = null;

  for (const d of diseases) {
    const terms: string[] = Array.isArray(d.hpo_terms) ? d.hpo_terms : [];
    const termSet = new Set(terms.map((t) => t.trim().toLowerCase()));
    let overlap = 0;
    for (const label of normalizedLabels) {
      if (termSet.has(label)) overlap++;
      else if ([...termSet].some((t) => t.includes(label) || label.includes(t))) overlap++;
    }
    if (overlap > 0 && (!best || overlap > best.overlap)) {
      best = {
        id: d.id,
        name: d.name,
        impact_tier: d.impact_tier ?? 2,
        overlap,
      };
    }
  }

  if (!best) return null;

  return {
    id: best.id,
    name: best.name,
    impact_tier: best.impact_tier,
    activity_multiplier: tierToMultiplier(best.impact_tier),
  };
}
