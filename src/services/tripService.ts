import { GoogleGenAI, Type } from "@google/genai";
import { TripPlan, TripInput } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const tripActivitySchema = {
  type: Type.OBJECT,
  properties: {
    time: { type: Type.STRING },
    place: { type: Type.STRING },
    activity: { type: Type.STRING },
    zone: { type: Type.STRING },
    whatToOrder: { type: Type.STRING },
    price: { type: Type.STRING },
    duration: { type: Type.STRING },
    distanceFromPrevious: { type: Type.STRING },
    why: { type: Type.STRING },
  },
  required: ["time", "place", "activity", "zone", "price", "duration", "why"],
};

const tripDaySchema = {
  type: Type.OBJECT,
  properties: {
    dayNumber: { type: Type.INTEGER },
    highlight: { type: Type.STRING },
    movementLevel: { type: Type.STRING, enum: ["Basso", "Medio", "Alto"] },
    efficiency: { type: Type.STRING },
    dailyBudget: { type: Type.STRING },
    activities: {
      type: Type.ARRAY,
      items: tripActivitySchema,
    },
  },
  required: ["dayNumber", "highlight", "movementLevel", "efficiency", "dailyBudget", "activities"],
};

const tripPlanSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        destination: { type: Type.STRING },
        duration: { type: Type.INTEGER },
        budgetTotal: { type: Type.STRING },
        mood: { type: Type.STRING },
        period: { type: Type.STRING },
        accommodationArea: { type: Type.STRING },
        accommodationWhy: { type: Type.STRING },
      },
      required: ["destination", "duration", "budgetTotal", "mood", "period", "accommodationArea", "accommodationWhy"],
    },
    days: {
      type: Type.ARRAY,
      items: tripDaySchema,
    },
    practicalTips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["summary", "days", "practicalTips"],
};

export async function generateTripPlan(input: TripInput, previousPlan?: TripPlan, modificationRequest?: string): Promise<TripPlan> {
  const prompt = `Sei "GIACOTRAVEL AI", un local expert che pianifica viaggi completi, reali e fluidi.
  
  ---
  
  🎯 OBIETTIVO:
  Generare un viaggio completo per ${input.destination} di ${input.days} giorni.
  Budget totale: ${input.budget}€
  Mood: ${input.mood}
  Periodo: ${input.period}
  
  ${modificationRequest ? `⚠️ RICHIESTA DI MODIFICA: "${modificationRequest}"
  Applica questa modifica al piano precedente senza stravolgere tutto se non necessario.` : ''}
  
  ---
  
  ⚠️ REGOLE CRITICHE:
  - Usa SOLO luoghi reali.
  - Nessuna attività generica.
  - Ogni attività deve avere un orario realistico e il luogo deve essere APERTO in quell'orario.
  - Raggruppa le attività per zona per evitare spostamenti inutili.
  - Specifica sempre la distanza/tempo tra un'attività e l'altra (es. "10 min a piedi").
  - Per i pasti, suggerisci un piatto specifico da ordinare.
  - Suggerisci la ZONA migliore dove dormire (non hotel specifici) e spiega perché.
  - Adatta l'itinerario al periodo (${input.period}): se piove/fa freddo attività indoor, se fa caldo pause fresche.
  
  ---
  
  📅 STRUTTURA GIORNALIERA:
  Ogni giorno deve avere un array di attività (activities).
  Includi almeno:
  1. 🌅 Mattina (09:00–12:00)
  2. 🍝 Pranzo (13:00)
  3. 🌇 Pomeriggio (15:00–18:00)
  4. 🌙 Sera (20:00+)
  
  Per ogni attività specifica: orario (time), luogo reale (place), cosa fare (activity), zona (zone), prezzo stimato (price), durata stimata (duration) e perché andarci (why).
  
  ---
  
  💰 GESTIONE BUDGET:
  Distribuisci il budget (${input.budget}€) su tutti i giorni. Mostra la spesa giornaliera stimata.
  
  ---
  
  🚀 RISULTATO:
  L'utente deve poter seguire il viaggio senza cercare altro. Deve sembrare pensato da un local, non turistico.
  
  ${previousPlan ? `Ecco il piano precedente da usare come base: ${JSON.stringify(previousPlan)}` : ''}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: tripPlanSchema,
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate trip plan");
  }

  return JSON.parse(response.text) as TripPlan;
}
