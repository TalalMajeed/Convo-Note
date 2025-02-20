const { WebSocketServer } = require("ws");
const { default: ollama } = require("ollama");

const wss = new WebSocketServer({ port: 5000 });
const clients = new Set();

wss.on("connection", (ws) => {
  console.log("Client connected to WebSocket");
  clients.add(ws);

  ws.on("message", async (message) => {
    try {
      const userInput = message.toString();
      console.log(`Received from client: ${userInput}`);

      let fullResponse = "";

      const responseGenerator = await ollama.chat({
        model: "llama3.2:3b",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful Doctor. Whatever input you get, ask a question from the patient to gather personal information. Do not answer more than one line. Answer in the shortest way possible",
          },
          { role: "user", content: userInput },
        ],
        stream: true,
      });

      for await (const chunk of responseGenerator) {
        if (ws.readyState !== ws.OPEN) break;

        const content = chunk.message?.content || "";
        fullResponse += content;
      }

      if (fullResponse.trim() && ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
            response: fullResponse.trim(),
            isComplete: true,
          })
        );
      }
    } catch (error) {
      console.error("Error processing message:", error);
      if (ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
            error: "Error processing your request",
          })
        );
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    clients.delete(ws);
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down WebSocket server...");
  clients.forEach((client) => {
    client.close();
  });
  wss.close(() => {
    console.log("Server shut down successfully");
    process.exit(0);
  });
});

console.log("WebSocket server running on ws://localhost:5000");
