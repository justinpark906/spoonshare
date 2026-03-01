🥄 SpoonShare | Global Design System (MASTER.md)

    Status: Active

    Version: 1.0.0

    Core Principle: Reduce Cognitive Load via Visual Silence.

🎨 1. Color Palette (OLED Dark Strategy)

We use a Low-Blue-Light palette to prevent eye strain during migraines or flares.
Category	Hex Code	Usage	Intent
Background	#020617	App Body	Deepest black for OLED battery saving.
Surface	#0f172a	Cards / Modals	Subtle elevation without harsh borders.
Primary	#2dd4bf	Battery (High)	Teal: Calm, medical, and high-contrast.
Warning	#f59e0b	Battery (Mid)	Amber: Soft caution, no "vibrating" reds.
Critical	#e11d48	Battery (Low)	Rose: Clear danger, but muted saturation.
Text Primary	#f8fafc	Headings	Near-white for maximum readability.
Text Secondary	#94a3b8	Meta/Labels	Reduced contrast for secondary info.
typography 2. Typography (The "Fog-Proof" Scale)

Font Stack: Inter (Sans-serif) for UI; JetBrains Mono for numerical data (Spoon counts).

    Header (H1): 24px | Semibold | Tracking: -0.02em

    Sub-header (H2): 18px | Medium | Tracking: -0.01em

    Body (Default): 16px | Regular | Leading: 1.6 (High line-height for readability)

    Data/Numbers: 14px | Monospace | High legibility for spoon counting.

📐 3. Spacing & Radius (The 8px Grid)

    Grid Unit: 8px

    Container Padding: 24px (Mobile) | 40px (Desktop)

    Border Radius: * 12px: Standard Cards

        9999px: Pill Buttons (Easier to tap during motor-control flares)

    Gaps: 16px between related items; 32px between sections.

🕹️ 4. Component Rules
A. The Glassmorphism Card

    Background: rgba(15, 23, 42, 0.6)

    Backdrop Blur: 12px

    Border: 1px solid rgba(255, 255, 255, 0.1)

    Shadow: Subtle outer glow (No heavy black dropshadows).

B. The Interactive Spoon

    Icon Set: Lucide-React (Minimalist variant).

    Weight: 1.5px (Thick enough to see during blur/fog).

🚫 5. Anti-Patterns (UI-UX Pro Max Constraints)

    NO NEON VIBRATION: Avoid #00FF00 or #FF00FF. These trigger sensory overload/migraines.

    NO TINY TOUCH TARGETS: All buttons must be at least 44x44px.

    NO UNANNOUNCED BLUR: The "Brain Fog" filter must have a toggle to be disabled for emergency navigation.

    NO INFINITE SCROLL: Use discrete sections. Infinite scrolling causes "decision fatigue."

    NO AUTOPLAY: Zero auto-playing videos or rapid flickering animations.

🧠 6. Accessibility (WCAG 2.1 Level AAA)

    Contrast: All text-to-background ratios must exceed 7:1.

    States: Interactive elements must have a clear outline-2 outline-teal-500 on focus.

    Motion: prefers-reduced-motion must be respected in all Framer Motion configs.
