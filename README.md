# Recall Tutor

A small multi-turn programming tutor built with Node.js 22+. The terminal client talks to a local HTTP backend. Only the backend reads the API key. No npm dependencies are required.

## Run on Windows

1. Open PowerShell in this folder. Run `Copy-Item .env.example .env`. Open `.env` in your editor and set `GEMINI_API_KEY` to your own Gemini API key. The account needs API access and available quota. The model can be changed with `GEMINI_MODEL`.
2. Run `npm start` and keep that terminal open.
3. In a second terminal in this folder, run `npm run chat`. Ask a question, then ask a follow-up. Use `/new` to start another conversation or `/quit` to exit.
4. Run `npm test` for offline regression tests. Run `npm run demo` against the running server for a real five-turn check. It prints the transcript and checks that the fifth reply contains a fresh random project label and the language from turn one. This makes five billable API requests.

## How memory works

POST /chat accepts `{"message":"I am learning Java"}` and returns `{"conversationId":"…","reply":"…"}`. Include that ID with subsequent messages. The client does this automatically. Omit it for a new conversation.

For each request the backend sends the tutor instructions, up to five previous successful question/answer pairs, and the current question to the Gemini Interactions API. Once a sixth pair succeeds, the oldest pair drops out together. Bounding input to 2,000 characters and output to 500 tokens per turn also bounds individual messages. Older facts can be forgotten. A failed call adds nothing to history, and overlapping requests for the same chat receive HTTP 409.

Sessions live in memory until the server restarts. The server listens only on localhost. This design suits a single-user assignment demo. A shared deployment would need session ownership, expiry, and shared storage.

## Privacy

To generate a reply, the backend sends the current message and up to five previous successful question/answer pairs to Google's Gemini API. Do not enter passwords, API keys, personal information, or other confidential content. The request sets `store` to `false`, but users should review Google's current terms and privacy information before using the service.

## Files

| File | Purpose |
| --- | --- |
| src/app.js | HTTP endpoint, validation and per-conversation history |
| src/provider.js | Tutor instructions, Gemini request, timeout and error handling |
| src/server.js | Start the local server |
| src/cli.js | Interactive chat and five-turn live check |
| test/chat.test.js | Offline HTTP and provider failure tests |

## Submit

Before submitting, run the live demo and try your own five-turn conversation in the CLI. For example, introduce a project name and language, ask three coding questions, then ask the tutor to recall both details. Keep the terminal transcript if your instructor wants evidence.

Create a public GitHub repository and upload the source files including `.gitignore` and `.env.example`. Keep your real `.env` local. Submit the public repository URL.

## License

This repository currently has no license. Public visibility does not grant permission to reuse, modify, or redistribute the code. Check course requirements before adding a license.
