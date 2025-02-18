"use client";
import { useState, useEffect } from "react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

export default function ChatPage() {
  const { transcript, listening, startListening, stopListening } =
    useSpeechRecognition();
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>(
    []
  );
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:3000");
    setWs(websocket);

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.response) {
        setMessages((prev) => [...prev, { sender: "AI", text: data.response }]);
      }
    };

    websocket.onclose = () => console.log("WebSocket closed");
    return () => websocket.close();
  }, []);

  useEffect(() => {
    if (transcript && ws?.readyState === WebSocket.OPEN) {
      ws.send(transcript);
      setMessages((prev) => [...prev, { sender: "You", text: transcript }]);
    }
  }, [transcript]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Voice AI Chat</h1>
      <div className="border p-4 h-80 overflow-auto">
        {messages.map((msg, index) => (
          <p
            key={index}
            className={msg.sender === "AI" ? "text-blue-600" : "text-gray-800"}
          >
            <strong>{msg.sender}:</strong> {msg.text}
          </p>
        ))}
      </div>
      <button
        className="bg-green-500 text-white p-2 mt-4"
        onClick={listening ? stopListening : startListening}
      >
        {listening ? "Stop Listening" : "Start Speaking"}
      </button>
    </div>
  );
}
