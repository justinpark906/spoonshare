"use client";

import { useEffect } from "react";
import { useSpoonStore } from "@/store/useSpoonStore";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LandingPage() {
  const { isLoading, syncWithSupabase } = useSpoonStore();
  const router = useRouter();

  useEffect(() => {
    syncWithSupabase();
  }, [syncWithSupabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-text-secondary text-body">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Hero Section */}
      <section className="px-grid-3 pt-[64px] pb-[48px] md:px-grid-5">
        <div className="max-w-4xl mx-auto text-center space-y-grid-4">
          <div className="flex justify-center">
            <Image
              src="/spoonshare-banner.png"
              alt="SpoonShare"
              width={720}
              height={360}
              className="rounded-2xl"
              priority
            />
          </div>

          <div className="space-y-grid-2">
            <h1 className="text-[36px] md:text-[48px] font-bold text-[#1E293B] leading-tight tracking-tight">
              Digital health consultant and predictor.
            </h1>
            <p className="text-[18px] md:text-[22px] text-[#64748B] max-w-2xl mx-auto leading-relaxed">
              Master your energy, predict your day, and validate the invisible.
            </p>
          </div>

          <div className="flex justify-center pt-grid-2">
            <button
              onClick={() => router.push("/login")}
              className="px-[40px] py-[16px] rounded-full bg-white text-[#4BA8A7] font-semibold text-[18px] transition-all duration-300 cursor-pointer shadow-[0_0_30px_rgba(75,168,167,0.25)] hover:shadow-[0_0_50px_rgba(75,168,167,0.4)] border border-[#4BA8A7]/20"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="px-grid-3 py-[48px] md:px-grid-5">
        <div className="max-w-3xl mx-auto bg-white/70 backdrop-blur-[12px] rounded-2xl border border-[#4BA8A7]/10 p-[40px] md:p-[56px] shadow-sm">
          <h2 className="text-[28px] md:text-[32px] font-bold text-[#1E293B] mb-grid-3 text-center">
            Why we created SpoonShare
          </h2>
          <p className="text-[16px] md:text-[18px] text-[#64748B] leading-relaxed text-center">
            Living with a rare disease shouldn&apos;t mean living in the dark.
            We built SpoonShare to turn the Spoon Theory into a scientific
            forecasting tool, giving you the clarity to navigate your day
            without the fear of a crash.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-grid-3 pt-[16px] pb-[80px] md:px-grid-5">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-grid-3">
          {/* Predictive Pacing */}
          <article className="bg-white/70 backdrop-blur-[12px] rounded-2xl border border-[#4BA8A7]/10 p-[32px] space-y-grid-2 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#4BA8A7]/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-[#4BA8A7]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
            </div>
            <h3 className="text-[18px] font-semibold text-[#1E293B] text-center">
              Predictive Pacing
            </h3>
            <p className="text-[14px] text-[#64748B] text-center leading-relaxed">
              Sync Apple Watch biometrics and local weather to calculate your
              daily energy budget.
            </p>
          </article>

          {/* Smart Scheduling */}
          <article className="bg-white/70 backdrop-blur-[12px] rounded-2xl border border-[#4BA8A7]/10 p-[32px] space-y-grid-2 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#4BA8A7]/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-[#4BA8A7]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
            </div>
            <h3 className="text-[18px] font-semibold text-[#1E293B] text-center">
              Smart Scheduling
            </h3>
            <p className="text-[14px] text-[#64748B] text-center leading-relaxed">
              AI-driven Google Calendar audits that identify crash risks and
              suggest recovery blocks.
            </p>
          </article>

          {/* Caregiver Sync */}
          <article className="bg-white/70 backdrop-blur-[12px] rounded-2xl border border-[#4BA8A7]/10 p-[32px] space-y-grid-2 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-xl bg-[#4BA8A7]/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-[#4BA8A7]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <h3 className="text-[18px] font-semibold text-[#1E293B] text-center">
              Caregiver Sync
            </h3>
            <p className="text-[14px] text-[#64748B] text-center leading-relaxed">
              Real-time energy sharing with your support network and automated
              SOS alerts.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
