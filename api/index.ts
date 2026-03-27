import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const app = express();
app.use(express.json());

// API Route for Flight Search
app.post("/api/flights", async (req, res) => {
  const { origin, destination, tripType, departureDate, returnDate } = req.body;

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Determine if it's Europe (simplified logic for backend)
  const isEuropePrompt = `Determina se sia la città di origine (${origin}) che quella di destinazione (${destination}) si trovano in Europa. Rispondi solo 'true' o 'false'.`;
  
  let isEurope = true;
  try {
    const europeResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: isEuropePrompt,
    });
    isEurope = europeResponse.text.trim().toLowerCase() === 'true';
  } catch (e) {
    console.error("Europe check failed:", e);
  }

  const airlines = isEurope 
    ? ["Ryanair", "easyJet", "Wizz Air", "Vueling", "ITA Airways", "Lufthansa", "Air France"] 
    : ["ITA Airways", "Lufthansa", "Emirates", "Air France", "Qatar Airways", "Turkish Airlines", "Delta", "United"];

  const prompt = `
    Sei un esperto di ricerca voli globale. Trova 3-5 opzioni di volo REALISTICHE per la seguente tratta:
    Da: ${origin}
    A: ${destination}
    Tipo: ${tripType}
    Partenza: ${departureDate} (YYYY-MM-DD)
    ${returnDate ? `Ritorno: ${returnDate} (YYYY-MM-DD)` : ""}

    REGOLE MANDATORIE PER I LINK DI PRENOTAZIONE (bookingUrl):
    1. Usa SOLO i link ufficiali "puliti" alla homepage o alla pagina di ricerca delle compagnie (NO deep link complessi).
    2. Esempi: 
       - Ryanair: https://www.ryanair.com/it/it
       - easyJet: https://www.easyjet.com/it
       - ITA Airways: https://www.ita-airways.com/it_it
       - Wizz Air: https://wizzair.com/it-it
       - Lufthansa: https://www.lufthansa.com/it/it/homepage
    3. NON includere parametri come codici IATA, date o tratte negli URL.
    4. Imposta sempre "hasDeepLink" a false.
    5. NON usare aggregatori (Skyscanner, Google Flights). Solo siti ufficiali.

    REGOLE PER I DATI:
    - Compagnie reali: ${airlines.join(", ")}.
    - Orari e durate credibili.
    - Prezzi realistici in Euro (es. "€ 45").

    Restituisci i dati in formato JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              airline: { type: Type.STRING },
              departureTime: { type: Type.STRING },
              arrivalTime: { type: Type.STRING },
              duration: { type: Type.STRING },
              price: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["Diretto", "Scalo"] },
              bookingUrl: { type: Type.STRING },
              hasDeepLink: { type: Type.BOOLEAN }
            },
            required: ["airline", "departureTime", "arrivalTime", "duration", "price", "type", "bookingUrl", "hasDeepLink"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return res.json([]);
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Error searching flights:", error);
    res.status(500).json({ error: "Failed to search flights" });
  }
});

export default app;
