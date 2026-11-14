import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { stdin, stdout } from "node:process";

let conversationId;
async function ask(message) {
  let response;
  try {
    response = await fetch("http://127.0.0.1:3000/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, conversationId }), signal: AbortSignal.timeout(35000)
    });
  } catch { throw new Error("Cannot reach Recall. Check that npm start is running and try again."); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  conversationId = data.conversationId;
  console.log("Recall:", data.reply);
  return data.reply;
}

if (process.argv.includes("--demo")) {
  const label = "Maple-" + randomUUID().slice(0, 8);
  const prompts = [
    "My project label is " + label + ". I am learning Java. Acknowledge briefly.",
    "Explain an array using a row of lockers.",
    "How do I access the first element?",
    "What happens if I access index -1?",
    "What exact project label and programming language did I mention at the start?"
  ];
  try {
    let last;
    for (const prompt of prompts) { console.log("You:", prompt); last = await ask(prompt); }
    if (!last.includes(label) || !/\bjava\b/i.test(last)) throw new Error("Five turns finished, but the recall check failed.");
    console.log("PASS: fifth reply recalled both first-turn details.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
} else {
  const cli = createInterface({ input: stdin, output: stdout });
  console.log("Recall programming tutor. Use /new for a fresh chat, /quit to exit.");
  try {
    while (true) {
      const line = (await cli.question("You: ")).trim();
      if (line === "/quit") break;
      if (line === "/new") { conversationId = undefined; console.log("Fresh chat started."); continue; }
      if (line) { try { await ask(line); } catch (error) { console.error(error.message); } }
    }
  } finally { cli.close(); }
}
