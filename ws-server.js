import { WebSocketServer } from "ws";
import ollama from "ollama";

const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws) => {
  console.log("Client connected to WebSocket");

  ws.on("message", async (message) => {
    const userInput = message.toString();
    console.log(`Received: ${userInput}`);

    const responseGenerator = await ollama.chat({
      model: "llama3.2:3b",
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: userInput },
      ],
      stream: true,
    });

    // Stream response back to frontend
    for await (const chunk of responseGenerator) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ response: chunk.message?.content || "" }));
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

console.log("WebSocket server running on ws://localhost:3000");
