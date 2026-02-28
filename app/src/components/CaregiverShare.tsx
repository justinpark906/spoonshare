"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useSpoonStore } from "@/store/useSpoonStore";

interface SharedLink {
  id: string;
  access_token: string;
  label: string;
  created_at: string;
}

export default function CaregiverShare() {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useSpoonStore();
  const supabase = createClient();

  useEffect(() => {
    if (!profile) return;
    loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadLinks() {
    const { data } = await supabase
      .from("shared_access")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setLinks(data);
  }

  async function createLink() {
    if (!newLabel.trim() || !profile) return;
    setIsCreating(true);

    const { error } = await supabase.from("shared_access").insert({
      owner_id: profile.id,
      label: newLabel.trim(),
    });

    if (!error) {
      setNewLabel("");
      await loadLinks();
    }
    setIsCreating(false);
  }

  async function deleteLink(id: string) {
    await supabase.from("shared_access").delete().eq("id", id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/status/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-800/50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">👥</span>
          <div className="text-left">
            <h3 className="text-base font-semibold text-white">
              Caregiver Sync
            </h3>
            <p className="text-xs text-slate-400">
              Share your energy status with your support network
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4">
              {/* Create new link */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Mom, Partner, Nurse..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition"
                  onKeyDown={(e) => e.key === "Enter" && createLink()}
                />
                <button
                  onClick={createLink}
                  disabled={isCreating || !newLabel.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition"
                >
                  {isCreating ? "..." : "Create Link"}
                </button>
              </div>

              {/* Existing links */}
              {links.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No caregiver links yet. Create one to share your energy
                  status.
                </p>
              ) : (
                <div className="space-y-2">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {link.label}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          /status/{link.access_token.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyLink(link.access_token)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                            copied === link.access_token
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          }`}
                        >
                          {copied === link.access_token
                            ? "Copied!"
                            : "Copy Link"}
                        </button>
                        <button
                          onClick={() => deleteLink(link.id)}
                          className="px-2 py-1.5 rounded text-xs text-red-400 hover:bg-red-500/10 transition"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-600">
                Caregivers can view your live energy level and claim tasks to
                restore your spoons.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
