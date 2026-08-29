const { GoogleGenAI } = require("@google/genai");

let client = null;

function getGeminiClient() {
  if (client) return client;

  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(
      new Error("GEMINI_API_KEY is not set. Add it to backend/.env."),
      { status: 500 }
    );
  }

  client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

module.exports = { getGeminiClient, MODEL };
