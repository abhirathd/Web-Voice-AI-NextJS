import { Deepgram } from "@deepgram/sdk";
import { LiveTranscription } from "@deepgram/sdk/dist/transcription/liveTranscription";
import dotenv from "dotenv";
dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

type TranscriptReceivedEventHandler = (data: string) => Promise<void>;

export function getDeepgramLiveConnection(
  transcriptReceivedEventHandler: TranscriptReceivedEventHandler
): LiveTranscription {
  // Instantiate Deepgram object
  if (!DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set in the environment variables.");
  }
  const deepgram = new Deepgram(DEEPGRAM_API_KEY);
  const deepgramLive = deepgram.transcription.live({
    language: "en",
    punctuate: true,
    smart_format: true,
    model: "nova",
  });

  // Add event listeners for open, close, and error
  deepgramLive.addListener("open", async () => {
    console.log("deepgram: connected successfully");
  });

  deepgramLive.addListener("close", async (data) => {
    console.log("deepgram: connection closed");
    // Don't call finish() here as it's already closing
  });

  deepgramLive.addListener("error", async (error) => {
    console.log("deepgram: error received");
    console.error(error);
  });

  // Add event listener for transcriptReceived - passed in by caller
  deepgramLive.addListener("transcriptReceived", transcriptReceivedEventHandler);

  return deepgramLive;
}