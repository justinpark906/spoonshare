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
    <div className="glass-card rounded-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-grid-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-200 cursor-pointer min-h-[44px]"
      >
        <div className="flex items-center gap-grid-2">
          <svg
            className="w-5 h-5 text-primary"
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
          <div className="text-left">
            <h3 className="text-body font-semibold text-text-primary">
              Caregiver Sync
            </h3>
            <p className="text-[12px] text-text-secondary">
              Share your energy status with your support network
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
            <div className="px-grid-3 pb-grid-3 space-y-grid-2">
              {/* Create new link */}
              <div className="flex gap-grid-1">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Mom, Partner, Nurse..."
                  aria-label="Caregiver link label"
                  className="flex-1 rounded-card border border-[rgba(255,255,255,0.1)] bg-surface px-grid-2 py-grid-1 text-data text-text-primary placeholder-text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors duration-200"
                  onKeyDown={(e) => e.key === "Enter" && createLink()}
                />
                <button
                  onClick={createLink}
                  disabled={isCreating || !newLabel.trim()}
                  className="px-grid-2 py-grid-1 rounded-card bg-primary hover:bg-primary/80 disabled:opacity-50 text-background text-data font-medium transition-colors duration-200 cursor-pointer min-h-[44px]"
                >
                  {isCreating ? "..." : "Create Link"}
                </button>
              </div>

              {/* Existing links */}
              {links.length === 0 ? (
                <p className="text-data text-text-secondary text-center py-grid-2">
                  No caregiver links yet. Create one to share your energy
                  status.
                </p>
              ) : (
                <div className="space-y-grid-1">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between bg-surface rounded-card px-grid-2 py-grid-2"
                    >
                      <div>
                        <p className="text-data font-medium text-text-primary">
                          {link.label}
                        </p>
                        <p className="text-[12px] text-text-secondary font-mono">
                          /status/{link.access_token.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-grid-1">
                        <button
                          onClick={() => copyLink(link.access_token)}
                          className={`px-grid-2 py-grid-1 rounded text-[12px] font-medium transition-colors duration-200 cursor-pointer min-h-[44px] ${
                            copied === link.access_token
                              ? "bg-primary/20 text-primary"
                              : "bg-[rgba(255,255,255,0.05)] text-text-secondary hover:bg-[rgba(255,255,255,0.1)]"
                          }`}
                        >
                          {copied === link.access_token
                            ? "Copied!"
                            : "Copy Link"}
                        </button>
                        <button
                          onClick={() => deleteLink(link.id)}
                          className="px-grid-1 py-grid-1 rounded text-[12px] text-critical hover:bg-critical/10 transition-colors duration-200 cursor-pointer min-h-[44px]"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[12px] text-text-secondary/60">
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
