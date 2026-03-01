import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary">
          Build Your Spoon Profile
        </h1>
        <p className="mt-2 text-text-secondary max-w-md mx-auto">
          Rate each symptom so our AI can calibrate your personal energy budget.
          This takes about 2 minutes.
        </p>
      </div>
      <OnboardingWizard />
    </div>
  );
}
