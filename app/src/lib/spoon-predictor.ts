/**
 * AI-powered spoon cost prediction using Groq + LangChain.
 *
 * Pipeline: Groq raw estimate → halve → apply disease multiplier → clamp 1-10
 * Groq gives a baseline estimate for a healthy person. The disease multiplier
 * then scales it based on the user's specific condition severity.
 */

import { ChatGroq } from "@langchain/groq";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

const predictionSchema = z.object({
  cost: z
    .number()
    .min(1)
    .max(10)
    .describe("Predicted spoon cost for this task (1-10)"),
  reason: z
    .string()
    .describe(
      "Brief explanation of the energy cost prediction (1-2 sentences)",
    ),
});

export type SpoonPrediction = {
  /** Raw Groq estimate (halved) before disease multiplier */
  baseCost: number;
  /** Final cost after disease multiplier applied */
  finalCost: number;
  /** Disease multiplier that was applied */
  multiplier: number;
  /** AI reasoning */
  reason: string;
  /** Warning if task would exceed available spoons */
  warning: string | null;
};

export interface PredictionInput {
  title: string;
  category?: string;
  currentSpoons: number;
  conditionTags: string[];
  activityMultiplier: number;
  impactTier: number | null;
  identifiedCondition?: string | null;
}

export async function getSpoonPrediction(
  input: PredictionInput,
): Promise<SpoonPrediction> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    const fallback = Math.max(
      1,
      Math.min(10, Math.round(3 * input.activityMultiplier)),
    );
    return {
      baseCost: 3,
      finalCost: fallback,
      multiplier: input.activityMultiplier,
      reason: "AI prediction unavailable — using default estimate.",
      warning: null,
    };
  }

  const parser = StructuredOutputParser.fromZodSchema(predictionSchema);
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a clinical energy assessment specialist. Predict the BASE spoon cost (1-10) for a task.
Do NOT factor in the user's disease or condition — just estimate the raw energy cost for an average person.
A separate disease multiplier will be applied after your estimate.

Scale reference:
- 1: Minimal (watching TV, scrolling phone)
- 2: Very light (reading, light phone call)
- 3: Light (cooking a simple meal, gentle stretching)
- 4: Light-moderate (short walk, light tidying)
- 5: Moderate (grocery shopping, 1-hour meeting)
- 6: Moderate-high (driving long distance, cleaning)
- 7: High (exercise session, deep cleaning)
- 8: Very high (long social event, heavy chores)
- 9: Intense (moving furniture, all-day outing)
- 10: Extreme (moving house, intense physical labor)

Be conservative with your estimates. Most daily tasks should fall in the 2-5 range.

{format_instructions}`,
    ],
    [
      "human",
      `Predict the base spoon cost for: {title}
Category hint: {category}`,
    ],
  ]);

  const model = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    apiKey: groqKey,
  });

  const chain = prompt.pipe(model).pipe(parser);

  const result = await chain.invoke({
    title: input.title,
    category: input.category || "unspecified",
    format_instructions: parser.getFormatInstructions(),
  });

  // Pipeline: Groq raw → halve → apply disease multiplier → clamp
  const halved = result.cost / 2;
  const scaled = halved * input.activityMultiplier;
  const finalCost = Math.max(1, Math.min(10, Math.round(scaled)));
  const baseCost = Math.max(1, Math.round(halved));

  // Generate warning if task would exceed remaining spoons
  let warning: string | null = null;
  if (finalCost > input.currentSpoons) {
    const over = finalCost - input.currentSpoons;
    warning = `This task would put you ${over} spoon${over !== 1 ? "s" : ""} over budget. Consider breaking it into smaller intervals or deferring to a higher-energy day.`;
  }

  return {
    baseCost,
    finalCost,
    multiplier: input.activityMultiplier,
    reason: result.reason,
    warning,
  };
}
