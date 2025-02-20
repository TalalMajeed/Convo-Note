"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Hospital } from "lucide-react";

interface AudioContextRef {
  current: AudioContext | null;
}

interface AnalyserRef {
  current: AnalyserNode | null;
}

interface MediaStreamSourceRef {
  current: MediaStreamAudioSourceNode | null;
}

interface AnimationFrameRef {
  current: number | null;
}

const AudioVisualizer: React.FC = () => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0);
  const [aiSpeaking, setAiSpeaking] = useState<boolean>(true);

  const audioContext: AudioContextRef = useRef(null);
  const analyzer: AnalyserRef = useRef(null);
  const microphone: MediaStreamSourceRef = useRef(null);
  const animationFrame: AnimationFrameRef = useRef(null);

  const startListening = async (): Promise<void> => {
    try {
      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      audioContext.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      analyzer.current = audioContext.current.createAnalyser();
      microphone.current = audioContext.current.createMediaStreamSource(stream);

      analyzer.current.fftSize = 256;
      microphone.current.connect(analyzer.current);

      setIsListening(true);
      analyze();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const analyze = (): void => {
    if (!analyzer.current) return;

    const dataArray = new Uint8Array(analyzer.current.frequencyBinCount);
    analyzer.current.getByteFrequencyData(dataArray);

    const average =
      dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    setVolume(average);

    animationFrame.current = requestAnimationFrame(analyze);
  };

  const stopListening = (): void => {
    if (microphone.current && microphone.current.mediaStream) {
      const tracks = microphone.current.mediaStream.getTracks();
      tracks.forEach((track: MediaStreamTrack) => track.stop());
      microphone.current.disconnect();

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }

      setIsListening(false);
      setVolume(0);
    }
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
    return 120 + volume * 2;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="relative">
        <div
          className={`absolute rounded-full transition-all duration-75 ${
            aiSpeaking
              ? "bg-green-100"
              : !isListening
              ? "bg-red-100"
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
          onClick={isListening ? stopListening : startListening}
          className={`relative z-10 p-6 rounded-full transition-colors ${
            aiSpeaking
              ? "bg-green-500"
              : !isListening
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
          disabled={aiSpeaking}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {!aiSpeaking && <Mic className="w-8 h-8 text-white" />}
          {aiSpeaking && <Hospital className="w-8 h-8 text-white" />}
        </button>
      </div>
    </div>
  );
};

export default AudioVisualizer;
