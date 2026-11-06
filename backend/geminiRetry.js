// geminiRetry.js  (put it next to server.js)
//
// One helper for any route that asks Gemini for JSON.
//   - Try 1 uses the main model (gemini-3.1-flash-lite).
//   - Tries 2+ use GEMINI_FALLBACK_MODEL if you set it in Render's Environment tab.
//     If it's not set, retries keep using the main model.
//   - Waits 2s, 4s, 6s between tries.
//   - Retries when Gemini is busy, rate-limited, or returns broken JSON.
//   - Does NOT retry on errors that will never succeed (bad request, bad key).
import { GEMINI_MODEL, fallbackModel, sleep, errorText, isRetryable } from './assessmentRoutes.js';

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS) || 2000;

export async function generateJsonWithFallback(ai, { label, contents, config, maxAttempts = MAX_ATTEMPTS }) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = attempt > 1 && fallbackModel() ? fallbackModel() : GEMINI_MODEL;
    try {
      const response = await ai.models.generateContent({ model, contents, config });
      const text = response?.text;
      if (!text) throw new Error('Gemini returned an empty response');

      // Parse inside the try so broken JSON is retried too
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.error(`${label} attempt ${attempt}/${maxAttempts} (${model}) failed:`, errorText(error));
      if (!isRetryable(error) || attempt === maxAttempts) break;
      await sleep(RETRY_BASE_MS * attempt);
    }
  }

  throw lastError;
}