# Pulse AI System Documentation

This document explains the integration, prompts, logic boundaries, and safety layers of the AI features implemented inside the Pulse developer social platform.

---

## 1. Why AI is Used

AI is integrated to augment the developer user experience and ensure safety without introducing high-latency blockers:
1. **AI Post Assistant**: Refines drafts directly inside the text editor. Assists developers in adjusting tones (e.g. professional networking, short concise updates, or engaging threads).
2. **AI Content Moderation**: Analyzes newly created posts and comments asynchronously via background queues to detect toxicity, slurs, hacks, and spam.

---

## 2. AI Heuristics & Scopes

### AI-Assisted Actions
- **Tonal Adaptations**: User drafts are sent to the AI with specific tone constraints. The AI output replaces the draft in-place.
- **Safety Pre-Check**: Checks content toxicity scoring across categories (toxic, slurs, cyber hacks).

### Manually Validated Actions (Admin Review)
- Moderated posts receive status states in the database (`PENDING`, `APPROVED`, `FLAGGED`, or `REJECTED`).
- If flagged or rejected:
  - The status is persisted.
  - A warning banner is prefixed to the text: `[FLAGGED - SENSITIVE CONTENT]`.
  - Admins can query the database status or content and manually override states to restore or remove content permanently.

---

## 3. High Availability & Fallback Policies

AI is an auxiliary feature and **never blocks core application flow**:

### Timeout Guard
- Every API call to Google Gemini 1.5 Flash has a strict **5-second timeout** managed via `AbortController`. If the API hangs, the request is canceled immediately to protect resources.

### API Down Fallback logic
If the Google Gemini REST API is down, returns an error status, or the `GEMINI_API_KEY` is not defined:
1. **Writing Assistant**:
   - Falls back to simple deterministic text adjustments:
     - `concise`: Truncates draft to 80 characters.
     - `professional`: Prefixes content with `"Hello network, I wanted to share this update..."`.
     - `engaging`: Prefixes content with `"🔥 Check this out! "` and appends `"🚀 #developers #pulse"`.
2. **Safety Moderation**:
   - Falls back to a local keyword-blacklist regex scan (`spam`, `malware`, `offensive`, `abuse`, `hack`).
   - Flagged matches transition the post status to `FLAGGED` or `REJECTED` deterministically.
