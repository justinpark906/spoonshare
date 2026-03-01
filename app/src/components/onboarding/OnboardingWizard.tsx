"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PHENOTYPES } from "@/lib/phenotypes";
import PhenotypeSlider from "./PhenotypeSlider";
import { useRouter } from "next/navigation";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(PHENOTYPES.map((p) => [p.id, 5]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const totalSteps = PHENOTYPES.length;
  const currentPhenotype = PHENOTYPES[step];
  const progress = ((step + 1) / totalSteps) * 100;

  function goNext() {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  }

  function goPrev() {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/profile-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyze profile");
      }

      const data = await res.json();
      if (data.profile?.identified_condition) {
        sessionStorage.setItem(
          "spoonshare_onboarding_disease_message",
          `We noticed your symptoms align with ${data.profile.identified_condition}. We've adjusted your energy budget to reflect this.`
        );
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-8">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>Clinical Profile</span>
          <span>
            {step + 1} of {totalSteps}
          </span>
        </div>
        <div className="h-2 bg-primary-pale/40 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Animated Step */}
      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="glass-card bg-surface rounded-2xl p-8"
          >
            <PhenotypeSlider
              phenotype={currentPhenotype}
              value={scores[currentPhenotype.id]}
              onChange={(val) =>
                setScores((prev) => ({ ...prev, [currentPhenotype.id]: val }))
              }
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <div className="bg-critical/10 border border-critical/30 text-critical rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <button
          onClick={goPrev}
          disabled={step === 0}
          className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-light text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Back
        </button>

        {step < totalSteps - 1 ? (
          <button
            onClick={goNext}
            className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-light text-white font-medium transition"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
          >
            {loading ? "Analyzing..." : "Generate My Spoon Profile ✨"}
          </button>
        )}
      </div>
    </div>
  );
}
