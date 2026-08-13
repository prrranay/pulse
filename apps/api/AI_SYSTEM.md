# Pulse AI System Documentation

This document explains the integration, prompts, logic boundaries, and safety layers of the AI features implemented inside the Pulse developer social platform.

---

## 1. Why AI is Used

AI is integrated to augment the developer user experience and ensure safety without introducing high-latency blockers:
1. **AI Post Assistant**: Assists developers in adjusting tones of drafts inside the text editor (e.g. professional networking, short concise updates, or engaging threads).
2. **AI Content Moderation**: Analyzes newly created posts and comments asynchronously via background queues to detect toxicity, slurs, hacks, and spam.

---

## 2. Model Configuration & Security

- **Dynamic Model Name**: The system uses the `GEMINI_MODEL` environment variable (validated via NestJS configuration validation schema) to specify the model to use (defaulting to `gemini-1.5-flash` for local development).
- **Backend API Isolation**: The Gemini API key (`GEMINI_API_KEY`) is stored securely in backend environment variables and is never exposed to Next.js client-side code, `NEXT_PUBLIC_` variables, or source control.

---

## 3. High Availability & Failure Behavior

AI is an auxiliary feature and **never blocks core application flow**:

### Timeout Guard
- Every API call to the Gemini REST API has a strict **5-second timeout** managed via `AbortController`. If the API hangs, the request is canceled immediately to protect resources.

### AI-Assisted Writing Failure Behavior
- If the Gemini API is down, missing, or times out, the system returns a controlled `503 Service Unavailable` error response to the user instead of displaying mock/local placeholder values. This ensures that the user is informed of the temporary provider failure.

### Moderation Failure Behavior
- If Gemini moderation fails (due to provider issues, timeout, or missing key), the system falls back to a deterministic **Local Blacklist keyword check** (`spam`, `malware`, `offensive`, `abuse`, `hack`).
- The post or comment status transitions to an explicit status (`FLAGGED`, `REJECTED`, or `APPROVED`) with a clear database log indicating the provider failure fallback.

---

## 4. Moderation Persistence

Each post or comment moderated stores the following data:
- **moderationStatus**: `PENDING`, `APPROVED`, `FLAGGED`, or `REJECTED`.
- **moderationReason**: A detailed reason describing the outcome (e.g. `"Gemini AI Safety Check: Content approved"` or `"Local Blacklist Check: Fallback executed due to provider error"`).
- **moderatedAt**: A timestamp recording exactly when the moderation check was completed.

Only posts with a status of `APPROVED` are displayed in the general public feeds.
