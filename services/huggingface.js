// Wrapper around Hugging Face's OpenAI-compatible chat completions endpoint.
// Uses fetch (project convention - no axios).

const HF_URL = 'https://router.huggingface.co/v1/chat/completions';
// ":auto" lets Hugging Face pick whichever backing provider currently has
// this model available, instead of us hardcoding one specific provider
// that might be rate-limited or retired (same lesson learned from FinSight AI).
const MODEL = 'meta-llama/Llama-3.3-70B-Instruct';

/**
 * Calls Hugging Face's chat completions endpoint with a plain prompt.
 * @param {string} prompt
 * @returns {Promise<string>} - the AI's plain text reply
 */
async function callHuggingFace(prompt) {
  if (!process.env.HF_API_TOKEN) {
    throw new Error('HF_API_TOKEN is not set in .env');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

  let response;
  try {
    response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Hugging Face request timed out after 25 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('Hugging Face returned no content: ' + JSON.stringify(data));
  }

  return text.trim();
}

/**
 * Generates platform-specific social content from a topic.
 * @param {string} topic - what the content should be about
 * @param {'linkedin' | 'twitter'} platform
 * @returns {Promise<string>}
 */
async function generateSocialContent(topic, platform) {
  let prompt;

  if (platform === 'linkedin') {
    prompt = `Write a LinkedIn post about the following topic: "${topic}"

Guidelines:
- Professional but conversational tone, not corporate-sounding
- 150-250 words
- Use short paragraphs and line breaks for readability
- End with 3-5 relevant hashtags
- Do not use markdown formatting (no asterisks, no headers)
- Do not include a "Subject:" line or any preamble - just the post content itself`;
  } else if (platform === 'twitter') {
    prompt = `Write a single tweet (not a thread) about the following topic: "${topic}"

Guidelines:
- Maximum 280 characters total, including hashtags
- Punchy, direct tone
- Include 1-2 relevant hashtags within the character limit
- Do not use markdown formatting
- Output only the tweet text itself, nothing else`;
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  return callHuggingFace(prompt);
}

module.exports = { callHuggingFace, generateSocialContent };