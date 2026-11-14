import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { generate, ChatError } from "./provider.js";

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new ChatError(413, "Request too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new ChatError(400, "Send a valid JSON object."); }
}

export function createApp(replyTo = generate) {
  const sessions = new Map();
  const busy = new Set();
  const historyMessages = 10; // Five complete user/assistant pairs.

  return createServer(async (req, res) => {
    function send(status, data) {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    }
    try {
      if (req.url !== "/chat" || req.method !== "POST") throw new ChatError(404, "Use POST /chat.");
      const body = await readBody(req);
      const message = typeof body?.message === "string" && body.message.trim();
      if (!message || message.length > 2000) throw new ChatError(400, "Enter 1 to 2000 characters.");
      const id = body.conversationId === undefined ? randomUUID() : body.conversationId;
      if (body.conversationId !== undefined && !sessions.has(id)) throw new ChatError(404, "Conversation expired or unknown. Start a new chat.");
      if (busy.has(id)) throw new ChatError(409, "Wait for the current reply before sending another message.");
      busy.add(id);
      try {
        const input = [...(sessions.get(id) || []), { role: "user", content: message }];
        const reply = await replyTo(input);
        sessions.set(id, [...input, { role: "assistant", content: reply }].slice(-historyMessages));
        send(200, { conversationId: id, reply });
      } finally { busy.delete(id); }
    } catch (error) {
      send(error instanceof ChatError ? error.status : 500, { error: error instanceof ChatError ? error.message : "Unexpected server error. Please retry." });
    }
  });
}
