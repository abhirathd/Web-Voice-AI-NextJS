const http = require("http");
const { Server } = require("socket.io");
const { getDeepgramLiveConnection } = require("./deepgram");
const { getOpenAIChatCompletion } = require("./openai");
const { getElevenLabsAudio } = require("./elevenLabs");
const dotenv = require("dotenv");
dotenv.config();

console.log("OPENAI_API_KEYY", process.env.OPENAI_API_KEYY);
console.log("DEEPGRAM_API_KEY", process.env.DEEPGRAM_API_KEY);
console.log("ELEVENLABS_API_KEY", process.env.ELEVENLABS_API_KEY);

const server = http.createServer();

const socketIOServer = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

let clientSocket;
let deepgramLive;

// Initialize Deepgram connection
function initializeDeepgramConnection() {
  console.log("Initializing new Deepgram connection...");
  deepgramLive = getDeepgramLiveConnection(async (data) => {
    const transcriptData = JSON.parse(data);
    if (transcriptData.type !== "Results") {
      return;
    }
    
    const transcript = transcriptData.channel.alternatives[0].transcript ?? "";
    const isFinal = transcriptData.is_final;
    
    if (transcript && clientSocket) {
      if (isFinal) {
        // Send final transcript
        console.log(`Final transcript: "${transcript}"`);
        clientSocket.emit("finalTranscript", transcript);
        
        // Process the message (get AI response and audio)
        await processUserMessage(transcript);
      } else {
        // Send interim transcript for real-time display
        clientSocket.emit("transcript", transcript);
      }
    }
  });
}

// Shared function to process user messages (from voice or text)
async function processUserMessage(message) {
  try {
    // Get AI response
    const openAIResponse = await getOpenAIChatCompletion(message);
    console.log(`AI Response: ${openAIResponse}`);
    
    // Send AI response text first
    clientSocket.emit("aiResponse", openAIResponse);
    
    // Then get and send audio
    const elevenLabsAudio = await getElevenLabsAudio(openAIResponse);
    clientSocket.emit("audioData", elevenLabsAudio);
    console.log("Sent audio data to frontend.");
  } catch (error) {
    console.error("Error processing user message:", error);
    clientSocket.emit("error", "Sorry, I encountered an error processing your message.");
  }
}

socketIOServer.on("connection", (socket) => {
  console.log("socket: client connected");
  clientSocket = socket;

  socket.on("packet-sent", (data) => {
    const readyState = deepgramLive?.getReadyState();
    
    if (readyState === 1) {
      // Connection is open, send data
      deepgramLive.send(data);
    } else if (readyState === 3 || readyState === undefined) {
      // Connection is closed or doesn't exist, reinitialize
      console.log("Deepgram connection closed, reinitializing...");
      initializeDeepgramConnection();
      clientSocket.emit("dg-connected")
      
      // Wait a moment for connection to establish, then try sending
      setTimeout(() => {
        if (deepgramLive?.getReadyState() === 1) {
          deepgramLive.send(data);
          console.log("Data sent after reconnection");
        } else {
          console.log("Failed to reconnect to Deepgram");
        }
      }, 1000);
    } else {
      console.log(
        `socket: data couldn't be sent to deepgram. readyState was ${readyState}`
      );
    }
  });

  // Handle text messages from frontend
  socket.on("textMessage", async (message) => {
    console.log(`Text message received: "${message}"`);
    
    // Echo the message back as finalTranscript for consistency
    clientSocket.emit("finalTranscript", message);
    
    // Process the message (get AI response and audio)
    await processUserMessage(message);
  });

  socket.on("disconnect", () => {
    console.log("socket: client disconnected");
    if (deepgramLive && deepgramLive.getReadyState() === 1) {
      deepgramLive.finish();
    }
  });
});

server.listen(4000, () => {
  console.log("server listening on port 4000");
});