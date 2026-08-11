# Hyperframes Composition Brief: StudentAI

## Objective
Create a short launch-style brag video for StudentAI, an AI-powered academic success platform.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds (5 scenes)

## Source Material
- Project root: `C:\Users\anmol\OneDrive\Desktop\Student_Dashboard`
- Primary files read: `README.md`, `client/src/tokens.css`, `client/src/pages/Dashboard.jsx`, `client/src/pages/Prediction.jsx`, `client/src/pages/AIAssistant.jsx`, `client/src/pages/landing/Hero.jsx`
- Product name: StudentAI
- Tagline / strongest claim: "StudentAI doesn't just show you your CGPA — it predicts where you're headed and helps you course-correct before it's a problem."
- Key UI or visual moment to recreate: the CGPA gauge card and stat cards from the dashboard; the AI command bar; the CGPA Predictor trajectory + required-SGPA banner
- Copy that must appear verbatim:
  - "mark me present for DBMS today" (assistant command)
  - "Set a target and see what SGPA you need each semester" (predictor subtitle)
  - "Maintain this SGPA each semester to hit CGPA 9.0" (required-SGPA insight style)
  - "Know where you're headed."

## Creative Direction
- Tone preset: `polished`
- Creative direction: premium EdTech SaaS launch — dark UI, violet accent, confident and precise, momentum and forward-looking framing, gen-z student audience
- Interpretation: few scenes, long holds, restraint. Short declarative lines. Clean reveals, slow crossfades. Confidence through stillness.
- Angle: every student already has the data to predict their academic future — most read it too late. StudentAI reads it for you, continuously, and course-corrects before the problem lands.
- Hook: "Your CGPA is already predicting your future." / "Most students read it too late."
- Outro / punchline: "StudentAI — Know where you're headed." + studentai.app
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals, waveform/equalizer graphics
  - Unrelated visual redesign — keep the obsidian + violet-aurora identity

## Visual Identity
- Background: #0b0b0b (obsidian); void #000000 for depth
- Text: #f5f5f5 (frost) primary; #aeaeae (pewter) secondary
- Accent: #a881fe (violet glow); #6419ff (deep iris); gradient #6419ff → #a881fe
- Surfaces: #111111 / #0f0f0f cards, #1a1a1a hover, 16px radii
- Status: success #10b981, warning #f59e0b, danger #ef4444
- Display font: Inter (project font), weight 500–640
- Body font: Inter
- Visual references from the project: CGPA gauge doughnut, stat card grid, violet-glow radial bloom, gradient wordmark

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3.5s — two text lines on obsidian with breathing violet glow
2. Dashboard reveal — 4.5s — CGPA gauge counts to 8.65, 3 stat cards arrive one by one
3. Assistant in use — 4.5s — command types "mark me present for DBMS today", DBMS row flips to PRESENT
4. Predictor — 4.5s — target 9.0, trajectory draws 9.19 → 8.65 → projected, required-SGPA banner (8.9)
5. Outro — 3.0s — gradient wordmark, tagline, URL, bell, fade out

## Audio
- Audio role: warm, steady, polished bed; sparse professional accents
- Audio arc: bed fades in over 0.8s, sits at 0.30, lifts slightly on the two major reveals, fades out in the final 1.5s
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (copied into composition assets)
- Music treatment: volume 0.30, fade-in 0.8s, fade-out 1.5s at end
- Music cue guidance: bundled preset at `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md` (110 BPM; strong cues 8.74s, 13.11s, 17.47s, 22.93s; beat grid every ~0.55s). Lock 1-2 majors: dashboard count-up settle ≈ 8.74s, predictor banner ≈ 17.47s, within ±0.15s. Snap stat-card arrivals to beats within ±0.10s.
- Audio-reactive treatment: subtle; use music RMS/bass to make the violet glow breathe and product cards gain presence. No waveform/equalizer visuals.
- Audio-coupled moments:
  - Scene 1 — text line pop-ins — soft drop accents
  - Scene 2 — stat cards sequence — card-landing accents, count-up tick
  - Scene 3 — typing — keyboard keypresses per character; success accent on PRESENT flip
  - Scene 4 — chart draw + banner — announcement on banner landing
  - Scene 5 — wordmark — single bell, music fade
- SFX selection guidance: polished restraint — 2-4 subtle cues total, low high-frequency risk files preferred. Keyboard set for typing (`assets/sfx/keyboard/keypress-*.wav`, randomized), soft drop/interface accents for pop-ins, one gentle announcement for the predictor result, one bell for the outro.
- SFX analysis guidance: `skills/brag/assets/sfx/sfx-analysis.md` (in the installed brag skill); prefer low/medium high-frequency-risk files.
- Exact SFX choice: choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: music copied to `brag-output/composition/assets/music/`; SFX directories created under `assets/sfx/`.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (dashboard cards, command bar, predictor).
- Keep all text readable in the final render (settled reads: ~0.8s for short labels, ~0.3s/word for lines).
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Major reveals may move toward strong cues within ±0.15s; small entrances to beats within ±0.10s. Use 1-3 strong cue locks.
- Use SFX to support motion and interaction; restraint when the edit is already busy.
- Consider subtle audio-reactive treatment: extract audio data and modulate the violet glow / card presence. Avoid waveform visuals.
- Use local assets for audio.
- Run `hyperframes check` before render — it is brag's single gate.
