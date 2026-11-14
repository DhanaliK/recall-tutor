import { Readable } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { ChatError, generate } from "../src/provider.js";

test("HTTP sessions isolate chats, trim pairs and preserve history on failure", async t => {
  const calls = [];
  const server = createApp(async input => {
    calls.push(input);
    if (input.at(-1).content === "fail") throw new ChatError(504, "Please retry.");
    return "ok";
  });
  async function post(message, conversationId) {
    const req = Readable.from([Buffer.from(JSON.stringify({ message, conversationId }))]);
    req.url = "/chat";
    req.method = "POST";
    return new Promise(resolve => {
      let status;
      server.emit("request", req, {
        writeHead(code) { status = code; },
        end(body) { resolve([status, JSON.parse(body)]); }
      });
    });
  }
  const [, first] = await post("1");
  const id = first.conversationId;
  for (let n = 2; n <= 7; n++) {
    assert.equal((await post(String(n), id))[0], 200);
    if (n === 5) assert.equal(calls.at(-1)[0].content, "1");
  }
  assert.equal(calls.at(-1).length, 11);
  assert.equal(calls.at(-1)[0].content, "2");
  assert.equal((await post("fail", id))[0], 504);
  await post("8", id);
  assert.deepEqual(calls.at(-1).filter(m => m.role === "user").map(m => m.content), ["3","4","5","6","7","8"]);
  await post("other");
  assert.equal(calls.at(-1).length, 1);
  assert.equal((await post("  ", id))[0], 400);
  assert.equal((await post("hello", "unknown"))[0], 404);
});

test("provider translates rate limits, timeouts and malformed output", async t => {
  const original = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "offline-test";
  t.after(() => {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
  });
  await assert.rejects(generate([], async () => new Response("", {status:429})), {status:429});
  await assert.rejects(generate([], async () => { throw new DOMException("", "TimeoutError"); }), {status:504});
  await assert.rejects(generate([], async () => Response.json({output:[]})), {status:502});
});

test("HTTP transport returns a reply", async t => {
  const server = createApp(async () => "Hello");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  try {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/chat", {
      method: "POST", body: JSON.stringify({message:"Hi"})
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reply, "Hello");
  } catch (error) {
    if (error.cause?.code === "EACCES") return t.skip("Local TCP connections blocked by host");
    throw error;
  }
});
test("Gemini request includes tutor instructions and previous turns", async t => {
  const original = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "offline";
  t.after(() => {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
  });
  const history = [{role:"user",content:"Java"},{role:"assistant",content:"Welcome"},{role:"user",content:"Which language?"}];
  const result = await generate(history, async (url, options) => {
    assert.match(url, /generativelanguage.googleapis.com/);
    const body = JSON.parse(options.body);
    assert.ok(body.input.includes(JSON.stringify(history)));
    assert.match(body.system_instruction, /programming tutor/);
    return Response.json({
      status: "completed",
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: "Java" }],
        },
      ],
    });
  });
  assert.equal(result, "Java");
});
