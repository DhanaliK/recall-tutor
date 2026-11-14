import { createApp } from "./app.js";
const server = createApp();
server.on("error", error => { console.error("Server could not start:", error.message); process.exitCode = 1; });
server.listen(3000, "127.0.0.1", () => console.log("Recall is ready at http://127.0.0.1:3000/chat"));
