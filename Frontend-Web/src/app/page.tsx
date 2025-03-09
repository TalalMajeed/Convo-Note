"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Hospital } from "lucide-react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

const AudioVisualizer: React.FC = () => {
  const [volume, setVolume] = useState<number>(0);
  const [aiSpeaking, setAiSpeaking] = useState<boolean>(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

  const { transcript, listening, startListening, stopListening, resetTranscript } = useSpeechRecognition();

  const audioContext = useRef<AudioContext | null>(null);
  const analyzer = useRef<AnalyserNode | null>(null);
  const microphone = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrame = useRef<number | null>(null);
  const speakTimeout = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:5000");
    setWs(websocket);

    websocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.response) {
        setAiSpeaking(true);
        setIsSpeaking(true);

        console.log(data.response);
        const utterance = new SpeechSynthesisUtterance(data.response);
        await speechSynthesis.speak(utterance);
        setIsSpeaking(false);
        if (microphone.current && microphone.current.mediaStream) {
          const tracks = microphone.current.mediaStream.getTracks();
          tracks.forEach((track) => track.stop());
          microphone.current.disconnect();
        }

        if (animationFrame.current) {
          cancelAnimationFrame(animationFrame.current);
        }

        stopListening();

        if (speakTimeout.current) {
          clearTimeout(speakTimeout.current);
        }

        speakTimeout.current = setTimeout(() => {
          if (!isSpeaking) {
            setAiSpeaking(false);
            setProcessing(false);
          }
        }, 3000);
      }
    };

    websocket.onclose = () => {
      setAiSpeaking(false);
    };

    return () => {
      websocket.close();
      if (speakTimeout.current) {
        clearTimeout(speakTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!transcript) return;

    // Clear previous silence timeout
    if (silenceTimeout.current) {
      clearTimeout(silenceTimeout.current);
    }

    // Start a new silence detection timeout
    silenceTimeout.current = setTimeout(() => {
      if (transcript && ws?.readyState === WebSocket.OPEN) {
        setProcessing(true);
        ws.send(JSON.stringify({ transcript }));
        resetTranscript(); // Clear transcript after sending
      }
    }, 3000); // Wait for 3 seconds of silence
  }, [transcript]);

  const initializeAudioAnalyzer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyzer.current = audioContext.current.createAnalyser();
      microphone.current = audioContext.current.createMediaStreamSource(stream);

      analyzer.current.fftSize = 256;
      microphone.current.connect(analyzer.current);

      analyze();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const analyze = (): void => {
    if (!analyzer.current) return;

    const dataArray = new Uint8Array(analyzer.current.frequencyBinCount);
    analyzer.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    setVolume(average);

    animationFrame.current = requestAnimationFrame(analyze);
  };

  const handleStartListening = async () => {
    await initializeAudioAnalyzer();
    startListening();
  };

  const handleStopListening = () => {
    if (microphone.current && microphone.current.mediaStream) {
      const tracks = microphone.current.mediaStream.getTracks();
      tracks.forEach((track) => track.stop());
      microphone.current.disconnect();
    }

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    stopListening();
    setVolume(0);
  };

  useEffect(() => {
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  const getCircleSize = (): number => {
    if (!listening || processing) return 120;
    return 120 + volume * 2;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="relative">
        <div
          className={`absolute rounded-full transition-all duration-75 ${
            aiSpeaking
              ? "bg-green-100"
              : !listening
              ? "bg-red-100"
              : processing
              ? "bg-orange-100"
              : "bg-blue-100"
          }`}
          style={{
            width: `${getCircleSize()}px`,
            height: `${getCircleSize()}px`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        <button
          onClick={listening ? handleStopListening : handleStartListening}
          className={`relative z-10 p-6 rounded-full transition-colors ${
            aiSpeaking
              ? "bg-green-500"
              : !listening
              ? "bg-red-500 hover:bg-red-600"
              : processing
              ? "bg-orange-500 hover:bg-orange-600"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
          disabled={aiSpeaking || processing}
          aria-label={listening ? "Stop listening" : "Start listening"}
        >
          {!aiSpeaking && <Mic className="w-8 h-8 text-white" />}
          {aiSpeaking && <Hospital className="w-8 h-8 text-white" />}
        </button>
      </div>
    </div>
  );
};

export default AudioVisualizer;
