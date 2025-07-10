const fetch = require("node-fetch");
const dotenv = require("dotenv");
dotenv.config();

const ELEVEN_LABS_VOICE_ID = "Z61JuDmU52ECd8UROolE";
const ELEVEN_LABS_API_KEY = process.env.ELEVENLABS_API_KEY;

async function getElevenLabsAudio(text) {
  const elevenLabsTextToSpeechURL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_LABS_VOICE_ID}/stream?optimize_streaming_latency=1`;
  if (!ELEVEN_LABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is not set in the environment variables.");
  }
  const headers = {
    accept: "audio/mpeg",
    "xi-api-key": ELEVEN_LABS_API_KEY,
    "Content-Type": "application/json",
  };
  const response = await fetch(elevenLabsTextToSpeechURL, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      text,
    }),
  });
  return response.arrayBuffer();
}

module.exports = { getElevenLabsAudio };