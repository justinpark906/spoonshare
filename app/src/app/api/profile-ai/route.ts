import { NextResponse } from "next/server";
import { ChatGroq } from "@langchain/groq";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PHENOTYPES } from "@/lib/phenotypes";
import {
  userSymptomLabels,
  findBestMatchingDisease,
} from "@/lib/disease-match";

const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";

// Zod schema for the structured AI output
const profileSchema = z.object({
  suggested_multiplier: z
    .number()
    .min(0.5)
    .max(3.0)
    .describe(
      "Energy cost multiplier based on symptom severity. 1.0 = baseline. Higher means activities cost more spoons."
    ),
  condition_tags: z
    .array(z.string())
    .describe(
      "Clinical condition tags inferred from the symptom pattern, e.g. 'Dysautonomia Risk', 'EDS Spectrum', 'ME/CFS Pattern'"
    ),
  educational_note: z
    .string()
    .describe(
      "A brief, empathetic sentence explaining why the multiplier was adjusted and what it means for the patient's energy budget."
    ),
});

// Zod schema for disease-specific immediate spoon depletion (0–10)
const diseasePenaltySchema = z.object({
  spoons_to_deplete: z
    .number()
    .min(0)
    .max(10)
    .describe(
      "Integer from 0 (no extra depletion) to 10 (extremely energy-burdensome disease) representing immediate spoons to subtract."
    ),
});

/** True only if the key looks like a real Groq key and is not a placeholder. */
function hasValidGroqKey(): boolean {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key || key.length < 20) return false;
  if (/your_groq|your-groq|placeholder|example\.com/i.test(key)) return false;
  return true;
}

/** Default profile when GROQ_API_KEY is missing or invalid (e.g. local dev). */
function getDefaultProfile(scores: Record<string, number>) {
  const avg =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    Math.max(1, Object.keys(scores).length);
  const multiplier = avg >= 7 ? 1.5 : avg >= 4 ? 1.2 : 1.0;
  return {
    suggested_multiplier: multiplier,
    condition_tags:
      avg >= 6
        ? [
            "General symptom load — add a valid GROQ_API_KEY for personalized tags",
          ]
        : [],
    educational_note:
      "Profile saved. Add a valid GROQ_API_KEY to .env.local for Groq-based multiplier and condition tags.",
  };
}

/** Compute immediate disease-related spoon depletion (0–10) from GARD symptom text. */
async function computeDiseasePenalty(symptomsRaw: string): Promise<number> {
  if (!symptomsRaw || !symptomsRaw.trim()) return 0;

  // Heuristic fallback if no Groq key
  const heuristic = () => {
    const text = symptomsRaw.toLowerCase();
    const terms = symptomsRaw.split(";").map((s) => s.trim()).filter(Boolean);
    let score = 0;

    const severeKeywords = [
      "cardiomyopathy",
      "dilated cardiomyopathy",
      "respiratory failure",
      "respiratory insufficiency",
      "encephalopathy",
      "seizure",
      "seizures",
      "myopathy",
      "ataxia",
      "wheelchair",
      "non-ambulatory",
      "ventricular",
      "pulmonary hypertension",
      "myelopathy",
      "myopathy",
      "developmental regression",
      "intellectual disability, severe",
    ];

    const fatigueKeywords = [
      "fatigue",
      "malaise",
      "weakness",
      "lethargy",
      "failure to thrive",
      "muscle weakness",
      "myalgia",
    ];

    const painKeywords = ["pain", "myalgia", "arthralgia"];

    const severeHits = severeKeywords.filter((k) => text.includes(k)).length;
    const fatigueHits = fatigueKeywords.filter((k) => text.includes(k)).length;
    const painHits = painKeywords.filter((k) => text.includes(k)).length;

    // Base on term count
    if (terms.length > 25) score += 4;
    else if (terms.length > 15) score += 3;
    else if (terms.length > 8) score += 2;
    else if (terms.length > 3) score += 1;

    score += severeHits * 2;
    score += fatigueHits;
    score += painHits * 0.5;

    return Math.max(0, Math.min(10, Math.round(score)));
  };

  if (!hasValidGroqKey()) {
    return heuristic();
  }

  try {
    const parser = StructuredOutputParser.fromZodSchema(diseasePenaltySchema);
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are an expert in chronic and rare diseases, specializing in energy impairment and functional capacity.

Given the symptom description for a specific disease, estimate how many spoons should be immediately depleted from a default 20-spoon day, where:
- 0 = minimal baseline impact beyond symptoms already captured elsewhere
- 1–3 = mild baseline depletion (disease adds some background strain)
- 4–7 = moderate baseline depletion (multi-system involvement, frequent limitations)
- 8–10 = severe baseline depletion (major organ involvement, progressive neuro or cardio, high disability)

Focus on how much unavoidable, always-on energy cost the disease creates, *before* considering daily activities.

Return a single integer field spoons_to_deplete from 0 to 10.

{format_instructions}`,
      ],
      [
        "human",
        `Here is the disease symptom description from the GARD database:

{symptoms}

Based on this, how many spoons should be immediately depleted (0–10)?`,
      ],
    ]);

    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: GROQ_MODEL,
      temperature: 0.2,
    });

    const chain = prompt.pipe(model).pipe(parser);
    const result = await chain.invoke({
      symptoms: symptomsRaw.slice(0, 2000),
      format_instructions: parser.getFormatInstructions(),
    });

    return Math.max(
      0,
      Math.min(10, Math.round(result.spoons_to_deplete ?? 0)),
    );
  } catch {
    return heuristic();
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the user
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse the incoming scores and optional disease name
    const body = await request.json();
    const { scores, disease_name } = body as {
      scores: Record<string, number>;
      disease_name?: string | null;
    };

    if (!scores || typeof scores !== "object") {
      return NextResponse.json(
        { error: "Missing symptom scores" },
        { status: 400 }
      );
    }

    let result: z.infer<typeof profileSchema>;

    if (hasValidGroqKey()) {
      try {
        // 3. Build the phenotype summary for the prompt
        const phenotypeSummary = PHENOTYPES.map(
          (p) => `- ${p.name} (${p.hpoCode}): ${scores[p.id] ?? "N/A"}/10`
        ).join("\n");

        const parser = StructuredOutputParser.fromZodSchema(profileSchema);
        const prompt = ChatPromptTemplate.fromMessages([
          [
            "system",
            `You are a clinical AI assistant specializing in rare and chronic disease energy management.
You use the Spoon Theory framework where each "spoon" represents a unit of energy.

Your task: analyze a patient's self-reported HPO phenotype severity scores and determine their energy cost multiplier.

Scoring guidelines:
- Base multiplier is 1.0 (healthy baseline = 20 spoons/day)
- Post-Exertional Malaise (PEM) score >= 7: increase multiplier by 0.3-0.5 (this is the strongest indicator of energy depletion)
- Orthostatic Intolerance >= 7: increase by 0.1-0.2 (standing/movement costs more)
- Chronic Pain >= 7: increase by 0.1-0.2 (pain is an energy drain)
- Joint Hypermobility >= 7: increase by 0.05-0.15 (physical tasks cost more)
- Sensory Hypersensitivity >= 7: increase by 0.05-0.15 (environmental exposure costs more)
- Multiplier should typically range from 1.0 (minimal symptoms) to 2.5 (severe multi-system involvement)

For condition_tags, infer likely clinical patterns:
- High PEM + fatigue pattern → "ME/CFS Pattern"
- High orthostatic + dizziness → "Dysautonomia Risk"
- High joint hypermobility + pain → "EDS Spectrum"
- High sensory sensitivity → "Sensory Processing Concern"
- Multiple high scores → "Complex Multi-System"

Be empathetic and precise. The educational_note should be one sentence a patient can understand.

{format_instructions}`,
          ],
          [
            "human",
            `Here are my symptom severity scores:

{phenotype_summary}

Please analyze my profile and provide the structured output.`,
          ],
        ]);

        const model = new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: GROQ_MODEL,
          temperature: 0.3,
        });

        const chain = prompt.pipe(model).pipe(parser);
        result = await chain.invoke({
          phenotype_summary: phenotypeSummary,
          format_instructions: parser.getFormatInstructions(),
        });
      } catch (groqErr: unknown) {
        // 401 invalid key, rate limit, or other API error — save profile with defaults
        const code = groqErr && typeof groqErr === "object" && "code" in groqErr ? (groqErr as { code?: string }).code : null;
        if (code === "invalid_api_key" || (groqErr && typeof groqErr === "object" && "status" in groqErr && (groqErr as { status?: number }).status === 401)) {
          result = getDefaultProfile(scores as Record<string, number>);
        } else {
          throw groqErr;
        }
      }
    } else {
      result = getDefaultProfile(scores as Record<string, number>);
    }

    // 4. Match to GARD disease (HPO overlap) and set activity_multiplier
    const profileUpdate: Record<string, unknown> = {
      symptom_data: scores,
      current_multiplier: result.suggested_multiplier,
      condition_tags: result.condition_tags,
      educational_note: result.educational_note,
    };
    const userLabels = userSymptomLabels(
      result.condition_tags,
      scores as Record<string, number>,
    );

    // Try to find a matching disease by HPO overlap
    const matchedDisease = await findBestMatchingDisease(supabase, userLabels);
    if (matchedDisease) {
      profileUpdate.disease_id = matchedDisease.id;
      profileUpdate.identified_condition = matchedDisease.name;
      profileUpdate.activity_multiplier = matchedDisease.activity_multiplier;
      profileUpdate.impact_tier = matchedDisease.impact_tier;
    } else {
      profileUpdate.disease_id = null;
      profileUpdate.identified_condition = null;
      profileUpdate.activity_multiplier = 1.0;
      profileUpdate.impact_tier = null;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save profile", details: updateError.message },
        { status: 500 }
      );
    }

    // 5. If the user provided an explicit disease name, estimate immediate spoon depletion
    let diseasePenalty = 0;
    if (typeof disease_name === "string" && disease_name.trim()) {
      const { data: diseaseRow } = await supabase
        .from("diseases")
        .select("id, name, symptoms_raw")
        .ilike("name", disease_name.trim())
        .maybeSingle();

      if (diseaseRow?.symptoms_raw) {
        diseasePenalty = await computeDiseasePenalty(diseaseRow.symptoms_raw);
      }
    }

    return NextResponse.json({
      success: true,
      profile: {
        suggested_multiplier: result.suggested_multiplier,
        condition_tags: result.condition_tags,
        educational_note: result.educational_note,
        symptom_data: scores,
        identified_condition: matchedDisease?.name ?? null,
        activity_multiplier: matchedDisease?.activity_multiplier ?? 1.0,
        impact_tier: matchedDisease?.impact_tier ?? null,
        disease_penalty: diseasePenalty,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Profile AI error:", err);
    return NextResponse.json(
      { error: "Profile update failed", details: message },
      { status: 500 }
    );
  }
}
