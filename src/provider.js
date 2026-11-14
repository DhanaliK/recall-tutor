export class ChatError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const instructions = `
You are Recall, a patient programming tutor.
Use the learner's stated programming language and examples.
Explain one idea at a time using clear, beginner-friendly language.
Use the conversation history when answering follow-up questions.
If a detail is missing, ask instead of inventing it.
Keep replies concise, usually under 300 words.
`;

export async function generate(input, request = fetch) {
  const key = process.env.GEMINI_API_KEY?.trim();

  if (!key) {
    throw new ChatError(
      503,
      "Set GEMINI_API_KEY in .env and restart the server."
    );
  }

  // JSON preserves message boundaries and escapes user-provided text.
  const conversation = JSON.stringify(input);
  const prompt = [
    "Continue the conversation below.",
    "The JSON array contains previous messages and the latest user message.",
    "Reply to the latest user message.",
    conversation
  ].join("\n");

  try {
    const response = await request(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Api-Revision": "2026-05-20",
          "Content-Type": "application/json"
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
          system_instruction: instructions,
          input: prompt,
          store: false
        })
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      if (response.ok) {
        throw new ChatError(502, "Gemini returned an invalid JSON response.");
      }

      // Preserve the HTTP error even when its body is empty or invalid.
      data = {};
    }

    if (!response.ok) {
      const providerMessage =
        typeof data.error?.message === "string"
          ? data.error.message.replaceAll(key, "[redacted]").slice(0, 500)
          : "No additional details were provided.";

      if (response.status === 429) {
        throw new ChatError(
          429,
          `Gemini quota or rate limit reached. ${providerMessage}`
        );
      }

      throw new ChatError(
        502,
        `Gemini request failed (HTTP ${response.status}). ${providerMessage}`
      );
    }

    const steps = Array.isArray(data.steps) ? data.steps : [];
    const reply = steps
      .filter(step => step.type === "model_output")
      .flatMap(step => Array.isArray(step.content) ? step.content : [])
      .filter(part => part.type === "text")
      .map(part => part.text || "")
      .join("")
      .trim();

    if (data.status !== "completed" || !reply) {
      throw new ChatError(
        502,
        "Gemini returned an incomplete or blocked reply. Try rephrasing."
      );
    }

    return reply;
  } catch (error) {
    if (error instanceof ChatError) {
      throw error;
    }

    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new ChatError(504, "Gemini took too long. Please retry.");
    }

    throw new ChatError(
      502,
      "Could not read a response from Gemini. Check your connection and retry."
    );
  }
}