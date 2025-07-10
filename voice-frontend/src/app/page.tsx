"use client";

import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import styles from "./page.module.css";

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isPlaying?: boolean;
}

export default function Home() {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
    });
  }, []);

  useEffect(() => {
    if (mediaRecorder) {
      const socket = io("ws://localhost:4000");
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Connected to voice server");
        
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0 && isListening) {
            socket.emit("packet-sent", event.data);
          }
        });

        // Start recording when connected
        if (mediaRecorder.state === "inactive") {
          mediaRecorder.start(500);
          setIsRecording(true);
        }
      });

      // Handle incoming transcripts (you'll need to modify your server to send these)
      socket.on("transcript", (transcript: string) => {
        if (transcript.trim()) {
          setCurrentTranscript(transcript);
        }
      });

      // Handle final transcript and add as user message
      socket.on("finalTranscript", (transcript: string) => {
        if (transcript.trim()) {
          const userMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content: transcript,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, userMessage]);
          setCurrentTranscript("");
          setIsListening(false);
        }
      });

      // Handle AI response text
      socket.on("aiResponse", (response: string) => {
        const aiMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: response,
          timestamp: new Date(),
          isPlaying: true
        };
        setMessages(prev => [...prev, aiMessage]);
      });

      // Handle audio response
      socket.on("audioData", (arrayBuffer: ArrayBuffer) => {
        setIsAISpeaking(false);
        const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(blob);
        const audioElement = new Audio(audioUrl);
        
        audioElement.onended = () => {
          setIsAISpeaking(false);
          setIsListening(true);
          
          // Update the message to show it's no longer playing
          setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
          
          // Resume recording for next input
          if (mediaRecorder.state === "paused") {
            mediaRecorder.resume();
          }
        };
        
        audioElement.play();
        
        // Pause recording while AI is speaking
        if (mediaRecorder.state === "recording") {
          mediaRecorder.pause();
        }
      });

      socket.on("disconnect", () => {
        console.log("Disconnected from voice server");
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [mediaRecorder, isListening]);

  const toggleListening = () => {
    if (isAISpeaking) return; // Don't allow toggling while AI is speaking
    
    setIsListening(!isListening);
    if (isListening) {
      // Stop listening
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.pause();
      }
    } else {
      // Start listening
      if (mediaRecorder && mediaRecorder.state === "paused") {
        mediaRecorder.resume();
      }
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>VoiceGPT Assistant</h1>
        <div className={styles.status}>
          {isAISpeaking ? (
            <span className={styles.speaking}>🎵 AI Speaking...</span>
          ) : isListening ? (
            <span className={styles.listening}>🎤 Listening...</span>
          ) : (
            <span className={styles.idle}>⏸️ Paused</span>
          )}
        </div>
      </div>

      <div className={styles.chatContainer}>
        <div className={styles.messagesContainer}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.message} ${
                message.type === 'user' ? styles.userMessage : styles.aiMessage
              }`}
            >
              <div className={styles.messageHeader}>
                <span className={styles.sender}>
                  {message.type === 'user' ? '👤 You' : '🤖 AI'}
                </span>
                <span className={styles.timestamp}>
                  {formatTime(message.timestamp)}
                  {message.isPlaying && <span className={styles.playingIndicator}> 🔊</span>}
                </span>
              </div>
              <div className={styles.messageContent}>
                {message.content}
              </div>
            </div>
          ))}
          
          {currentTranscript && (
            <div className={`${styles.message} ${styles.userMessage} ${styles.tempMessage}`}>
              <div className={styles.messageHeader}>
                <span className={styles.sender}>👤 You</span>
                <span className={styles.timestamp}>typing...</span>
              </div>
              <div className={styles.messageContent}>
                {currentTranscript}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.controls}>
          <button
            onClick={toggleListening}
            disabled={isAISpeaking}
            className={`${styles.controlButton} ${
              isListening ? styles.listening : styles.paused
            } ${isAISpeaking ? styles.disabled : ''}`}
          >
            {isAISpeaking ? '🎵' : isListening ? '🎤' : '⏸️'}
            <span>
              {isAISpeaking ? 'AI Speaking' : isListening ? 'Listening' : 'Paused'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}