import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PHENOTYPES } from "@/lib/phenotypes";

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

    // 2. Parse the incoming scores
    const { scores } = await request.json();

    if (!scores || typeof scores !== "object") {
      return NextResponse.json(
        { error: "Missing symptom scores" },
        { status: 400 }
      );
    }

    // 3. Build the phenotype summary for the prompt
    const phenotypeSummary = PHENOTYPES.map(
      (p) => `- ${p.name} (${p.hpoCode}): ${scores[p.id] ?? "N/A"}/10`
    ).join("\n");

    // 4. Set up LangChain with structured output
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

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.3,
    });

    const chain = prompt.pipe(model).pipe(parser);

    const result = await chain.invoke({
      phenotype_summary: phenotypeSummary,
      format_instructions: parser.getFormatInstructions(),
    });

    // 5. Save to Supabase
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        symptom_data: scores,
        current_multiplier: result.suggested_multiplier,
        condition_tags: result.condition_tags,
        educational_note: result.educational_note,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 }
      );
    }

    // 6. Return the AI analysis
    return NextResponse.json({
      success: true,
      profile: {
        suggested_multiplier: result.suggested_multiplier,
        condition_tags: result.condition_tags,
        educational_note: result.educational_note,
        symptom_data: scores,
      },
    });
  } catch (err) {
    console.error("Profile AI error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
