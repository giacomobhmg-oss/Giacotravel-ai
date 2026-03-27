import { GoogleGenAI, Type } from "@google/genai";
import { Itinerary, UserInput } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const itinerarySchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        city: { type: Type.STRING },
        mood: { type: Type.STRING },
        time_available: { type: Type.STRING },
        weather: { type: Type.STRING },
        budget_total: { type: Type.STRING },
        budget_spent: { type: Type.STRING },
        budget_remaining: { type: Type.STRING },
      },
      required: ["city", "mood", "time_available", "weather", "budget_total", "budget_spent", "budget_remaining"],
    },
    itinerary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING },
          title: { type: Type.STRING },
          area: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                place: { type: Type.STRING },
                activity: { type: Type.STRING },
                cost: { type: Type.STRING },
                move: { type: Type.STRING },
                duration: { type: Type.STRING },
                why: { type: Type.STRING },
                mapUrl: { type: Type.STRING },
              },
              required: ["place", "activity", "cost", "move", "duration", "why"],
            },
          },
        },
        required: ["time", "title", "area", "steps"],
      },
    },
  },
  required: ["summary", "itinerary"],
};

export async function generateItinerary(input: UserInput): Promise<Itinerary> {
  const moodsString = input.moods.join(', ');
  const energyLevel = input.energyLevel || 'Normale';
  
  const energyInstructions = {
    'Stanco': 'L\'utente è STANCO: riduci al minimo gli spostamenti, preferisci luoghi vicini tra loro o attività sedentarie/rilassanti. Massimo relax.',
    'Normale': 'L\'utente si sente NORMALE: bilancia bene attività e spostamenti.',
    'Carico': 'L\'utente è CARICO: aggiungi più attività, camminate, esplorazione intensa e luoghi dinamici.'
  }[energyLevel];

  const prompt = `Sei "GIACOTRAVEL AI", un assistente personale ultra-veloce e intuitivo che crea giornate perfette, reali e ottimizzate.
  
  ---
  
  🎯 OBIETTIVO:
  Organizzare una giornata completa a ${input.city || 'una città a tua scelta (Surprise Me)'} basata su:
  - budget: ${input.budget}€
  - mood: ${moodsString}
  - tempo: ${input.duration}
  - energia: ${energyLevel}
  - meteo: (usa Google Search per il meteo REALE attuale)
  
  ---
  
  ⚡ ISTRUZIONI ENERGIA:
  ${energyInstructions}
  
  ---
  
  ⏰ LOGICA DI APERTURA OBBLIGATORIA (CRITICO):
  Ogni attività DEVE essere immediatamente eseguibile e il luogo DEVE essere aperto nell'orario suggerito.
  NON suggerire MAI un luogo che apre dopo l'orario indicato o che è chiuso in quella fascia.
  
  Usa queste fasce orarie standard per la validazione:
  
  1. Ristoranti/Pizzerie/Trattorie: 
     - Pranzo: 12:00–15:00
     - Cena: 19:00–23:00
  2. Bar/Caffè/Colazione: 
     - 07:00–20:00
  3. Musei/Gallerie/Monumenti: 
     - 09:00–18:00
  4. Nightlife (Club/Disco/Lounge): 
     - 22:00–03:00
  5. Luoghi Generici (Piazze, Parchi, Belvedere): 
     - 09:00–19:00
  
  ---
  
  🧭 VALIDAZIONE INCROCIATA:
  Per ogni tappa:
  1. Scegli l'orario preciso (es. 13:30).
  2. Identifica il tipo di luogo.
  3. Verifica: il luogo è aperto alle 13:30? 
     - Se SI: procedi.
     - Se NO: SCARTA il luogo e scegline uno compatibile (es. non suggerire un museo alle 20:30).
  
  ---
  
  🧭 STRUTTURA RIGIDA:
  Genera ESATTAMENTE 4 blocchi:
  1. 🌅 Mattina (es. 09:30) -> SOLO luoghi aperti alle 09:30 (Bar, Musei, Parchi)
  2. 🍝 Pranzo (es. 13:00) -> SOLO Ristoranti/Bar aperti a pranzo
  3. 🌇 Pomeriggio (es. 16:00) -> SOLO Musei, Parchi, Bar
  4. 🌙 Sera (es. 20:30) -> SOLO Ristoranti o Nightlife aperti a cena
  
  ---
  
  ⚠️ REGOLE CRITICHE:
  - NO frasi come "potrebbe essere chiuso" o "verifica orari". L'itinerario deve essere CERTO.
  - SOLO luoghi reali e conosciuti.
  - TESTI BREVI: l'utente deve capire in 2 secondi.
  - NO spostamenti illogici.
  - NO sforamento budget (${input.budget}€).
  
  ---
  
  🚀 RISULTATO:
  L'utente deve poter leggere, andare e trovare aperto. SEMPRE. ZERO errori logici.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: itinerarySchema,
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate itinerary");
  }

  return JSON.parse(response.text) as Itinerary;
}
