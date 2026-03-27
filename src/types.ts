export type Mood = 
  | 'Low budget' | 'Risparmio estremo' | 'Spendi bene' | 'Lusso'
  | 'Relax totale' | 'Zero stress' | 'Solo chill'
  | 'Avventura' | 'Esplorazione urbana' | 'Autentico locale' | 'Turista intelligente'
  | 'Solo cibo' | 'Street food' | 'Food premium' | 'Cultura & musei'
  | 'Party / nightlife' | 'Romantico' | 'Social / Instagram'
  | 'Giornata produttiva' | 'Last minute';

export type TimeDuration = '2-3 ore' | 'Mezza giornata' | 'Giornata intera';

export type EnergyLevel = 'Stanco' | 'Normale' | 'Carico';

export interface Step {
  place: string;
  activity: string;
  cost: string;
  move: string;
  duration: string;
  why: string;
  whatToOrder?: string;
  photoSpot?: string;
  mapUrl?: string;
}

export interface ItineraryBlock {
  time: string;
  title: string;
  area: string;
  steps: Step[];
}

export interface Itinerary {
  summary: {
    city: string;
    mood: string;
    time_available: string;
    weather: string;
    budget_total: string;
    budget_spent: string;
    budget_remaining: string;
  };
  itinerary: ItineraryBlock[];
}

export interface UserInput {
  budget: number | string;
  city: string;
  moods: Mood[];
  duration: TimeDuration;
  energyLevel?: EnergyLevel;
  mode?: 'normal' | 'near_me' | 'surprise_me' | 'fast_plan';
}

export interface SavedDay {
  id: number;
  city: string;
  budget: number | string;
  moods: Mood[];
  itinerary: Itinerary;
  date: string;
}

export type TripMood = 'Relax' | 'Avventura' | 'Cultura' | 'Party' | 'Lusso';

export interface TripActivity {
  time: string;
  place: string;
  activity: string;
  zone: string;
  whatToOrder?: string;
  price: string;
  duration: string;
  distanceFromPrevious?: string;
  why: string;
}

export interface TripDay {
  dayNumber: number;
  highlight: string;
  movementLevel: 'Basso' | 'Medio' | 'Alto';
  efficiency: string;
  dailyBudget: string;
  activities: TripActivity[];
}

export interface TripPlan {
  summary: {
    destination: string;
    duration: number;
    budgetTotal: string;
    mood: string;
    period: string;
    accommodationArea: string;
    accommodationWhy: string;
  };
  days: TripDay[];
  practicalTips: string[];
}

export interface TripInput {
  destination: string;
  days: number;
  budget: number | string;
  mood: TripMood;
  period: string;
}

export interface FlightOption {
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: string;
  type: 'Diretto' | 'Scalo';
  bookingUrl: string;
  hasDeepLink: boolean;
}

export interface FlightInput {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  tripType: 'Solo andata' | 'Andata e ritorno';
}
