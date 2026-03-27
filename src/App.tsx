/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  Euro, 
  MapPin, 
  Clock, 
  Smile, 
  ArrowRight, 
  Sun, 
  Utensils, 
  Camera, 
  Moon, 
  Map,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Share2,
  RotateCcw,
  Zap,
  Bookmark,
  Trash2,
  ExternalLink,
  Calendar,
  History,
  Hotel,
  Briefcase,
  TrendingUp,
  Info,
  ChevronDown,
  Plane
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Mood, TimeDuration, EnergyLevel, UserInput, Itinerary, ItineraryBlock, SavedDay, TripPlan, TripInput, TripMood } from './types';
import { generateItinerary } from './services/gemini';
import { generateTripPlan } from './services/tripService';
import { CityAutocomplete } from './components/CityAutocomplete';
import { FlightSearch } from './components/FlightSearch';
import { fetchWeather, WeatherData } from './services/weather';
import { getOpeningStatus } from './utils/openingHours';

export default function App() {
  const [input, setInput] = useState<UserInput>({
    budget: '',
    city: '',
    moods: ['Relax totale'],
    duration: 'Mezza giornata',
    energyLevel: 'Normale'
  });
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [weather, setWeather] = useState<WeatherData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number>(-1);
  const [manualOffset, setManualOffset] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [savedDays, setSavedDays] = useState<SavedDay[]>([]);
  
  // Trip Planning State
  const [viewMode, setViewMode] = useState<'daily' | 'trip' | 'flights'>('daily');
  const [tripInput, setTripInput] = useState<TripInput>({
    destination: '',
    days: 3,
    budget: '',
    mood: 'Cultura',
    period: 'Estate'
  });
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [modificationRequest, setModificationRequest] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('giacotravel_saved_days');
    if (saved) {
      try {
        setSavedDays(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved days", e);
      }
    }
  }, []);

  const isCurrentDaySaved = itinerary ? savedDays.some(day => 
    day.city === (input.city || itinerary.summary.city) && 
    Number(day.budget) === Number(input.budget) &&
    JSON.stringify(day.itinerary) === JSON.stringify(itinerary)
  ) : false;

  const handleSaveDay = () => {
    if (!itinerary || isCurrentDaySaved) return;
    
    const newDay: SavedDay = {
      id: Date.now(),
      city: input.city || itinerary.summary.city,
      budget: input.budget,
      moods: [...input.moods],
      itinerary: itinerary,
      date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    const updated = [newDay, ...savedDays];
    setSavedDays(updated);
    localStorage.setItem('giacotravel_saved_days', JSON.stringify(updated));
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F27D26', '#ffffff']
    });
  };

  const handleDeleteDay = (id: number) => {
    const updated = savedDays.filter(day => day.id !== id);
    setSavedDays(updated);
    localStorage.setItem('giacotravel_saved_days', JSON.stringify(updated));
  };

  const handleOpenDay = (day: SavedDay) => {
    setItinerary(day.itinerary);
    setInput({
      city: day.city,
      budget: day.budget,
      moods: day.moods,
      duration: day.itinerary.summary.time_available as TimeDuration,
      energyLevel: 'Normale'
    });
    setWeather(undefined);
    setIsLiveMode(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isLiveMode || !itinerary || isCompleted) return;

    const updateCurrentStep = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hours + minutes / 60;

      // Mapping slots to approximate hour ranges
      // Mattina: 8-12, Pranzo: 12-14.5, Pomeriggio: 14.5-19.5, Sera: 19.5-24
      let index = -1;
      if (currentTime >= 8 && currentTime < 12) index = 0;
      else if (currentTime >= 12 && currentTime < 14.5) index = 1;
      else if (currentTime >= 14.5 && currentTime < 19.5) index = 2;
      else if (currentTime >= 19.5 || currentTime < 2) index = 3; // Night/Late evening

      if (index !== -1) {
        setCurrentBlockIndex((index + manualOffset) % itinerary.itinerary.length);
      }
    };

    updateCurrentStep();
    const interval = setInterval(updateCurrentStep, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isLiveMode, itinerary, manualOffset]);

  const handleGenerate = async (mode: 'normal' | 'near_me' | 'surprise_me' | 'fast_plan' = 'normal') => {
    if (mode !== 'surprise_me' && !input.city) {
      setError('Inserisci una città per iniziare');
      return;
    }
    
    if (input.budget === '' || input.budget === undefined || isNaN(Number(input.budget))) {
      setError('Inserisci un budget');
      return;
    }

    setLoading(true);
    setError(null);
    setIsLiveMode(false);
    setManualOffset(0);
    setIsCompleted(false);
    setWeather(undefined);
    try {
      let result: Itinerary;
      let weatherData: WeatherData | null = null;

      if (mode === 'surprise_me' || mode === 'near_me') {
        // For surprise/near me, we need the city from the AI first
        result = await generateItinerary({ ...input, mode });
        if (result?.summary?.city) {
          weatherData = await fetchWeather(result.summary.city);
        }
      } else {
        // For normal mode, we can fetch in parallel
        const [itineraryResult, fetchedWeather] = await Promise.all([
          generateItinerary({ ...input, mode }),
          fetchWeather(input.city)
        ]);
        result = itineraryResult;
        weatherData = fetchedWeather;
      }
      
      if (!result || !result.itinerary || result.itinerary.length === 0) {
        throw new Error("L'IA non ha restituito un itinerario valido.");
      }
      setItinerary(result);
      setWeather(weatherData || null); // Ensure it's null if fetch failed
      if ((mode === 'surprise_me' || mode === 'near_me') && result.summary?.city) {
        setInput(prev => ({ ...prev, city: result.summary.city }));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error("Generation error:", err);
      setError('Qualcosa è andato storto. Riprova tra un istante.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    if (loading) return;
    
    let newInput = { ...input };
    const actionLower = action.toLowerCase();
    const currentBudget = Number(input.budget) || 0;
    if (actionLower.includes('economico')) {
      newInput.budget = Math.max(10, currentBudget - 20);
      newInput.moods = ['Low budget'];
    } else if (actionLower.includes('lusso')) {
      newInput.budget = currentBudget + 100;
      newInput.moods = ['Lusso'];
    } else if (actionLower.includes('cibo')) {
      newInput.moods = ['Solo cibo'];
    } else if (actionLower.includes('relax')) {
      newInput.moods = ['Relax totale'];
    } else if (actionLower.includes('sera')) {
      newInput.moods = ['Party / nightlife'];
    }
    
    setInput(newInput);
    setLoading(true);
    setError(null);
    setIsLiveMode(false);
    setManualOffset(0);
    setIsCompleted(false);
    setWeather(undefined);
    try {
      const [result, weatherData] = await Promise.all([
        generateItinerary(newInput),
        fetchWeather(newInput.city)
      ]);
      
      if (!result || !result.itinerary) throw new Error("Invalid response");
      setItinerary(result);
      setWeather(weatherData || null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error("Quick action error:", err);
      setError('Non sono riuscito a modificare l\'itinerario. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTrip = async (modRequest?: string) => {
    if (!tripInput.destination) {
      setError('Inserisci una destinazione');
      return;
    }

    if (!modRequest && (tripInput.budget === '' || tripInput.budget === undefined || isNaN(Number(tripInput.budget)))) {
      setError('Inserisci un budget');
      return;
    }

    setTripLoading(true);
    setError(null);
    try {
      // Fetch weather in parallel
      const weatherPromise = fetchWeather(tripInput.destination);
      const tripPromise = generateTripPlan(tripInput, tripPlan || undefined, modRequest);
      
      const [weatherResult, tripResult] = await Promise.all([weatherPromise, tripPromise]);
      
      setWeather(weatherResult);
      setTripPlan(tripResult);
      setModificationRequest('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error("Trip generation error:", err);
      setError('Errore nella generazione del viaggio. Riprova.');
    } finally {
      setTripLoading(false);
    }
  };

  const reset = () => {
    setItinerary(null);
    setWeather(undefined);
    setError(null);
    setIsLiveMode(false);
    setCurrentBlockIndex(-1);
    setManualOffset(0);
    setIsCompleted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep = () => {
    if (!itinerary) return;
    
    const nextOffset = manualOffset + 1;
    
    // Calculate what the index would be
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours + minutes / 60;
    
    let baseIndex = -1;
    if (currentTime >= 8 && currentTime < 12) baseIndex = 0;
    else if (currentTime >= 12 && currentTime < 14.5) baseIndex = 1;
    else if (currentTime >= 14.5 && currentTime < 19.5) baseIndex = 2;
    else if (currentTime >= 19.5 || currentTime < 2) baseIndex = 3;

    if (baseIndex + nextOffset >= itinerary.itinerary.length) {
      setIsCompleted(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00F0FF', '#FFFFFF', '#141414'],
        ticks: 200
      });
    } else {
      setManualOffset(nextOffset);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Il mio viaggio con Giacotravel AI',
        text: `Ho appena completato il mio itinerario a ${itinerary?.summary.city}!`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert("Copiato negli appunti!");
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accent/30 selection:text-brand-accent px-4 py-8">
      <div className="max-w-app">
        {/* Header */}
        <header className="flex flex-col items-center text-center mb-8" onClick={reset}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 mb-4 cursor-pointer"
          >
            <div className="p-2 bg-brand-accent/10 rounded-xl">
              <Compass className="w-6 h-6 text-brand-accent" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white uppercase">Giacotravel AI</span>
            {isLiveMode && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-accent/20 border border-brand-accent/30"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                <span className="text-[8px] font-bold text-brand-accent uppercase tracking-tighter">Live</span>
              </motion.div>
            )}
          </motion.div>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 mb-6">
            <button 
              onClick={() => setViewMode('daily')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-dim hover:text-white'}`}
            >
              Giornata
            </button>
            <button 
              onClick={() => setViewMode('trip')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'trip' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-dim hover:text-white'}`}
            >
              Viaggio 🌍
            </button>
            <button 
              onClick={() => setViewMode('flights')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'flights' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-dim hover:text-white'}`}
            >
              Voli ✈️
            </button>
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white mb-2 tracking-tight"
          >
            {viewMode === 'daily' ? 'Dove vuoi andare oggi?' : viewMode === 'trip' ? 'Pianifica il tuo viaggio' : 'Trova il tuo volo'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-brand-text-dim text-lg"
          >
            {viewMode === 'daily' ? 'Ti organizzo la giornata perfetta' : viewMode === 'trip' ? 'Itinerario completo giorno per giorno' : 'Voli reali con prenotazione diretta'}
          </motion.p>
        </header>

        <AnimatePresence mode="wait">
          {viewMode === 'daily' ? (
            !itinerary && !loading ? (
              <motion.div
                key="daily-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="glass p-6 rounded-3xl border border-white/5 space-y-6">
                  {/* City */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-brand-accent" /> Città
                    </label>
                    <CityAutocomplete
                      value={input.city}
                      onChange={(val) => setInput({ ...input, city: val })}
                      placeholder="Es. Roma, Milano, Parigi..."
                    />
                  </div>

                  {/* Budget & Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                        <Euro className="w-3 h-3 text-brand-accent" /> Budget (€)
                      </label>
                      <input
                        type="number"
                        className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all text-sm"
                        value={input.budget}
                        onChange={(e) => setInput({ ...input, budget: e.target.value })}
                        placeholder="€ 50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-3 h-3 text-brand-accent" /> Tempo
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all appearance-none cursor-pointer text-sm"
                          value={input.duration}
                          onChange={(e) => setInput({ ...input, duration: e.target.value as TimeDuration })}
                        >
                          <option value="2-3 ore">2-3 ore</option>
                          <option value="Mezza giornata">Mezza giornata</option>
                          <option value="Giornata intera">Giornata intera</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dim pointer-events-none rotate-90" />
                      </div>
                    </div>
                  </div>

                  {/* Energy Level */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                      <Zap className="w-3 h-3 text-brand-accent" /> Come ti senti?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Stanco', 'Normale', 'Carico'] as EnergyLevel[]).map((level) => {
                        const isSelected = input.energyLevel === level;
                        const icons = {
                          Stanco: '😴',
                          Normale: '😊',
                          Carico: '⚡'
                        };
                        return (
                          <button
                            key={level}
                            onClick={() => setInput({ ...input, energyLevel: level })}
                            className={`
                              py-3 rounded-2xl border transition-all flex flex-col items-center gap-1
                              ${isSelected 
                                ? 'bg-brand-accent/20 border-brand-accent text-brand-accent shadow-lg shadow-brand-accent/10' 
                                : 'bg-brand-bg/50 border-white/5 text-brand-text-dim hover:border-white/20'}
                            `}
                          >
                            <span className="text-lg">{icons[level]}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest">{level}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mood */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                      <Smile className="w-3 h-3 text-brand-accent" /> Mood
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['Relax totale', 'Avventura', 'Solo cibo', 'Cultura', 'Lusso', 'Low budget'].map((m) => {
                        const isSelected = input.moods.includes(m as Mood);
                        return (
                          <button
                            key={m}
                            onClick={() => setInput({ ...input, moods: [m as Mood] })}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                              isSelected 
                                ? 'bg-brand-accent text-brand-bg border-brand-accent' 
                                : 'bg-white/5 text-brand-text-dim border-white/5 hover:border-brand-accent/30'
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col gap-3 bg-red-400/10 p-5 rounded-3xl border border-red-400/20"
                  >
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                      <AlertCircle className="w-5 h-5" /> {error}
                    </div>
                    <button 
                      onClick={() => handleGenerate('normal')}
                      className="text-xs font-bold uppercase tracking-widest text-red-400/70 hover:text-red-400 transition-colors text-left"
                    >
                      Tenta di nuovo →
                    </button>
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleGenerate('normal')}
                  className="w-full bg-brand-accent text-brand-bg font-bold py-5 rounded-3xl flex items-center justify-center gap-3 transition-all text-lg shadow-lg shadow-brand-accent/20"
                >
                  Crea la tua giornata <ArrowRight className="w-5 h-5" />
                </motion.button>

                {/* Saved Days Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-8 border-t border-white/5"
                >
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                      <History className="w-4 h-4 text-brand-accent" /> Le mie giornate
                    </h3>
                    {savedDays.length > 0 && (
                      <span className="text-[10px] font-bold text-brand-text-dim uppercase bg-white/5 px-2 py-1 rounded-lg">
                        {savedDays.length} salvate
                      </span>
                    )}
                  </div>

                  {savedDays.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {savedDays.map((day) => (
                        <motion.div
                          key={day.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          whileHover={{ scale: 1.01 }}
                          className="glass p-4 rounded-2xl border border-white/5 flex items-center justify-between group"
                        >
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-sm">{day.city}</span>
                            <div className="flex items-center gap-2 text-[10px] text-brand-text-dim font-medium">
                              <Calendar className="w-3 h-3" /> {day.date}
                              <span className="text-white/10">•</span>
                              <Euro className="w-3 h-3" /> {day.budget}€
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDay(day)}
                              className="p-2 bg-brand-accent/10 text-brand-accent rounded-xl hover:bg-brand-accent/20 transition-all"
                              title="Apri"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDay(day.id)}
                              className="p-2 bg-red-400/10 text-red-400 rounded-xl hover:bg-red-400/20 transition-all"
                              title="Elimina"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-white/5 rounded-3xl border border-dashed border-white/10">
                      <p className="text-xs font-medium text-brand-text-dim/50 italic">
                        Non hai ancora salvato giornate
                      </p>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            ) : loading ? (
              <motion.div
                key="daily-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="w-16 h-16 relative mb-6">
                  <div className="absolute inset-0 border-4 border-brand-accent/20 rounded-full" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-t-4 border-brand-accent rounded-full"
                  />
                </div>
                <p className="text-xl font-bold text-white text-center shimmer bg-clip-text text-transparent">
                  Sto creando la tua giornata...
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="daily-results"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.1 } }
                }}
                className="space-y-8 pb-20"
              >
                {/* Budget Summary */}
                {itinerary?.summary && (
                  <div className="space-y-4">
                    {weather !== undefined && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1e293b] p-4 rounded-2xl border border-white/5 flex items-center justify-center gap-3 shadow-lg"
                      >
                        {weather ? (
                          <div className="flex items-center gap-2 text-white">
                            <span className="text-lg font-bold">{weather.temp}°C</span>
                            <span className="text-white/30">•</span>
                            <span className="text-sm font-medium capitalize text-brand-text-dim">{weather.condition}</span>
                            <span className="text-white/30">•</span>
                            <span className="text-sm font-bold text-brand-accent">{weather.advice}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-brand-text-dim/50">Meteo non disponibile</span>
                        )}
                      </motion.div>
                    )}

                    {!isLiveMode ? (
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setIsLiveMode(true)}
                          className="w-full bg-brand-accent/10 border border-brand-accent/30 text-brand-accent font-bold py-4 rounded-3xl flex items-center justify-center gap-2 transition-all text-sm"
                        >
                          <RefreshCw className="w-4 h-4" /> Inizia giornata
                        </motion.button>
                        <motion.button
                          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                          whileHover={{ scale: isCurrentDaySaved ? 1 : 1.02 }}
                          whileTap={{ scale: isCurrentDaySaved ? 1 : 0.98 }}
                          onClick={handleSaveDay}
                          disabled={isCurrentDaySaved}
                          className={`w-full border font-bold py-4 rounded-3xl flex items-center justify-center gap-2 transition-all text-sm ${
                            isCurrentDaySaved 
                              ? 'bg-green-400/10 border-green-400/30 text-green-400 cursor-default' 
                              : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${isCurrentDaySaved ? 'fill-current' : ''}`} /> 
                          {isCurrentDaySaved ? 'Salvata' : 'Salva'}
                        </motion.button>
                      </div>
                    ) : isCompleted ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1.02 }}
                        className="bg-brand-accent text-brand-bg p-8 rounded-3xl shadow-2xl shadow-brand-accent/30 text-center relative overflow-hidden"
                      >
                        <motion.div 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="relative z-10"
                        >
                          <h2 className="text-3xl font-bold mb-2">Splendida giornata! 🎉</h2>
                          <p className="font-medium opacity-80 mb-8">Hai seguito tutto il piano</p>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={reset}
                              className="flex items-center justify-center gap-2 py-4 bg-brand-bg text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-brand-bg/90 transition-all"
                            >
                              <RotateCcw className="w-4 h-4" /> Rifai
                            </button>
                            <button
                              onClick={handleShare}
                              className="flex items-center justify-center gap-2 py-4 bg-white text-brand-bg rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition-all"
                            >
                              <Share2 className="w-4 h-4" /> Condividi
                            </button>
                          </div>
                        </motion.div>
                        
                        {/* Decorative background elements */}
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                          <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl" />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-brand-accent text-brand-bg p-6 rounded-3xl shadow-xl shadow-brand-accent/20"
                      >
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-brand-bg animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Ora in corso</span>
                          </div>
                          <button 
                            onClick={() => setIsLiveMode(false)}
                            className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100"
                          >
                            Esci
                          </button>
                        </div>
                        {currentBlockIndex >= 0 && itinerary.itinerary[currentBlockIndex] ? (
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <h2 className="text-2xl font-bold leading-tight">
                                {itinerary.itinerary[currentBlockIndex].steps[0]?.place || 'Prossima tappa'}
                              </h2>
                              <p className="font-medium opacity-90">
                                {itinerary.itinerary[currentBlockIndex].steps[0]?.activity}
                              </p>
                            </div>

                            {itinerary.itinerary[currentBlockIndex].steps[0]?.place && (
                              <motion.a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${itinerary.itinerary[currentBlockIndex].steps[0].place} ${itinerary.summary.city}`.trim())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all"
                              >
                                <MapPin className="w-4 h-4" /> Vai ora
                              </motion.a>
                            )}
                            
                            <button
                              onClick={handleNextStep}
                              className="w-full py-3 bg-brand-bg/20 hover:bg-brand-bg/30 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all"
                            >
                              Passaggio successivo <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="font-bold">Nessuna attività prevista per quest'ora.</p>
                            <button
                              onClick={() => {
                                setManualOffset(0);
                                setCurrentBlockIndex(0);
                              }}
                              className="w-full py-3 bg-brand-bg/20 hover:bg-brand-bg/30 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all"
                            >
                              Inizia dalla mattina <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <motion.div 
                      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                      className="glass p-6 rounded-3xl border border-white/5"
                    >
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-brand-text-dim tracking-widest mb-1">Budget</p>
                        <p className="text-3xl font-bold text-white">{itinerary.summary.budget_total}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-brand-text-dim tracking-widest mb-1">Spesi</p>
                        <p className="text-xl font-bold text-brand-accent">{itinerary.summary.budget_spent}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${Math.min((parseFloat(itinerary.summary.budget_spent) / parseFloat(itinerary.summary.budget_total)) * 100, 100) || 0}%` 
                        }}
                        className="h-full bg-brand-accent"
                      />
                    </div>
                  </motion.div>
                  </div>
                )}

                {/* Itinerary Blocks */}
                <div className="space-y-4">
                  {itinerary?.itinerary.map((block, idx) => (
                    <MinimalBlockCard 
                      key={idx} 
                      block={block} 
                      isCurrent={isLiveMode && idx === currentBlockIndex} 
                      city={itinerary.summary.city}
                    />
                  ))}
                </div>

                {/* Maps Button */}
                {itinerary?.itinerary && itinerary.itinerary.length > 0 && (
                  <motion.div
                    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                    className="pt-2"
                  >
                    {(() => {
                      const findDestination = () => {
                        const blocks = itinerary.itinerary;
                        const priority = ['sera', 'pranzo', 'pomeriggio', 'mattina'];
                        for (const p of priority) {
                          const block = blocks.find(b => b.title.toLowerCase().includes(p));
                          if (block && block.steps.length > 0) return block.steps[0].place;
                        }
                        return blocks[0].steps[0]?.place;
                      };
                      const destination = findDestination();
                      if (!destination) return null;

                      return (
                        <motion.a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.03, boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)' }}
                          whileTap={{ scale: 0.97 }}
                          transition={{ duration: 0.3 }}
                          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-[#38bdf8] text-[#0a0a0a] rounded-[16px] font-bold text-sm shadow-lg"
                        >
                          <Map className="w-5 h-5" />
                          Vai con Maps
                        </motion.a>
                      );
                    })()}
                  </motion.div>
                )}

                {/* Quick Actions */}
                <div className="space-y-4">
                  <p className="text-center text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">Modifica rapida</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      'Più economico', 
                      'Più lusso', 
                      'Cambia sera', 
                      'Più relax', 
                      'Solo cibo'
                    ].map(action => (
                      <button
                        key={action}
                        onClick={() => handleQuickAction(action)}
                        className="px-4 py-2 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-wider hover:bg-brand-accent/10 hover:border-brand-accent/30 transition-all"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={reset}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-brand-text-dim hover:text-white transition-all"
                >
                  Nuova ricerca
                </button>
              </motion.div>
            )
          ) : viewMode === 'trip' ? (
            /* Trip Planning Mode */
            !tripPlan && !tripLoading ? (
              <motion.div
                key="trip-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="glass p-6 rounded-3xl border border-white/5 space-y-6">
                  {/* Destination */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-brand-accent" /> Destinazione
                    </label>
                    <CityAutocomplete
                      value={tripInput.destination}
                      onChange={(val) => setTripInput({ ...tripInput, destination: val })}
                      placeholder="Es. Giappone, New York, Sicilia..."
                    />
                  </div>

                  {/* Days & Budget */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-brand-accent" /> Giorni
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="14"
                        className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all text-sm"
                        value={tripInput.days}
                        onChange={(e) => setTripInput({ ...tripInput, days: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                        <Euro className="w-3 h-3 text-brand-accent" /> Budget Totale (€)
                      </label>
                      <input
                        type="number"
                        className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all text-sm"
                        value={tripInput.budget}
                        onChange={(e) => setTripInput({ ...tripInput, budget: e.target.value })}
                        placeholder="Quanto vuoi spendere?"
                      />
                    </div>
                  </div>

                  {/* Mood & Period */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                        <Smile className="w-3 h-3 text-brand-accent" /> Mood
                      </label>
                      <div className="relative">
                        <select
                          className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all appearance-none cursor-pointer text-sm"
                          value={tripInput.mood}
                          onChange={(e) => setTripInput({ ...tripInput, mood: e.target.value as TripMood })}
                        >
                          <option value="Relax">Relax</option>
                          <option value="Avventura">Avventura</option>
                          <option value="Cultura">Cultura</option>
                          <option value="Party">Party</option>
                          <option value="Lusso">Lusso</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dim pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                        <Sun className="w-3 h-3 text-brand-accent" /> Periodo
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Agosto, Inverno..."
                        className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all text-sm"
                        value={tripInput.period}
                        onChange={(e) => setTripInput({ ...tripInput, period: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-400/10 p-4 rounded-2xl border border-red-400/20 text-red-400 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleGenerateTrip()}
                  className="w-full bg-brand-accent text-brand-bg font-bold py-5 rounded-3xl flex items-center justify-center gap-3 transition-all text-lg shadow-lg shadow-brand-accent/20"
                >
                  Pianifica il viaggio <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            ) : tripLoading ? (
              <motion.div
                key="trip-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="w-16 h-16 relative mb-6">
                  <div className="absolute inset-0 border-4 border-brand-accent/20 rounded-full" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-t-4 border-brand-accent rounded-full"
                  />
                </div>
                <p className="text-xl font-bold text-white text-center shimmer bg-clip-text text-transparent">
                  Sto pianificando il tuo viaggio da sogno...
                </p>
                <p className="text-xs text-brand-text-dim mt-2">Cerco i posti migliori per te</p>
              </motion.div>
            ) : (
              <TripPlanDisplay 
                plan={tripPlan!} 
                weather={weather}
                onModify={(req) => handleGenerateTrip(req)} 
                onReset={() => setTripPlan(null)}
              />
            )
          ) : (
            /* Flight Search Mode */
            <motion.div
              key="flight-search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <FlightSearch />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface MinimalBlockCardProps {
  block: ItineraryBlock;
  isCurrent?: boolean;
  city?: string;
}

const MinimalBlockCard: React.FC<MinimalBlockCardProps> = ({ block, isCurrent, city }) => {
  const getIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('mattina')) return <Sun className="w-5 h-5 text-orange-400" />;
    if (t.includes('pranzo')) return <Utensils className="w-5 h-5 text-green-400" />;
    if (t.includes('pomeriggio')) return <Camera className="w-5 h-5 text-brand-accent" />;
    if (t.includes('sera')) return <Moon className="w-5 h-5 text-purple-400" />;
    return <Clock className="w-5 h-5 text-brand-accent" />;
  };

  return (
    <motion.div 
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className={`glass p-6 rounded-3xl border transition-all duration-500 space-y-6 ${
        isCurrent ? 'border-brand-accent ring-1 ring-brand-accent/50 bg-brand-accent/5' : 'border-white/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isCurrent ? 'bg-brand-accent/20' : 'bg-white/5'}`}>
            {getIcon(block.title)}
          </div>
          <div className="flex flex-col">
            <h3 className={`text-lg font-bold ${isCurrent ? 'text-brand-accent' : 'text-white'}`}>{block.title}</h3>
            <span className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">{block.time}</span>
          </div>
        </div>
        {isCurrent && (
          <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest animate-pulse">In corso</span>
        )}
      </div>

      <div className="space-y-6">
        {block.steps?.map((step, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex-1 pr-4">
                <h4 className="font-bold text-white text-base">{step.place}</h4>
                <p className="text-brand-accent text-xs font-semibold uppercase tracking-wide mt-0.5">{step.activity}</p>
                
                {/* Opening Hours Status */}
                {(() => {
                  const status = getOpeningStatus(step.place, step.activity);
                  // Only show if open, hide if closed or unknown as per strict requirements
                  if (status.status !== 'open') return null;
                  
                  return (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-1 flex flex-col gap-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-green-400">
                          {status.message}
                        </span>
                        {status.detail && (
                          <span className="text-[9px] text-brand-text-dim/60 font-medium">
                            • {status.detail}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}
              </div>
              <p className="font-bold text-white text-sm whitespace-nowrap">{step.cost}</p>
            </div>
            <p className="text-brand-text-dim text-sm leading-relaxed">{step.why}</p>
            <div className="flex items-center gap-4 pt-2">
              <span className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {step.duration || '1h'}
              </span>
              {step.place && (
                <motion.a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${step.place} ${city || ''}`.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(56, 189, 248, 0.2)' }}
                  whileTap={{ scale: 0.95 }}
                  className="px-3 py-1.5 rounded-[16px] bg-[#38bdf8]/10 border border-[#38bdf8]/30 text-[10px] font-bold text-[#38bdf8] uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm hover:shadow-[#38bdf8]/20"
                >
                  <MapPin className="w-3 h-3" /> Vai ora
                </motion.a>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface TripPlanFormProps {
  input: TripInput;
  setInput: (input: TripInput) => void;
  onGenerate: () => void;
  loading: boolean;
}

const TripPlanForm: React.FC<TripPlanFormProps> = ({ input, setInput, onGenerate, loading }) => {
  const moods: TripMood[] = ['Relax', 'Avventura', 'Cultura', 'Party', 'Lusso'];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="space-y-4">
        <label className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest ml-1">Destinazione</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <MapPin className="h-5 w-5 text-brand-accent group-focus-within:scale-110 transition-transform" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-brand-text-dim/50 focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent/50 transition-all outline-none"
            placeholder="Dove vuoi andare?"
            value={input.destination}
            onChange={(e) => setInput({ ...input, destination: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest ml-1">Durata (Giorni)</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-brand-accent" />
            </div>
            <input
              type="number"
              min="1"
              max="14"
              className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none"
              value={input.days}
              onChange={(e) => setInput({ ...input, days: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest ml-1">Budget Totale (€)</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Euro className="h-5 w-5 text-brand-accent" />
            </div>
            <input
              type="number"
              className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none"
              value={input.budget}
              onChange={(e) => setInput({ ...input, budget: e.target.value })}
              placeholder="Quanto vuoi spendere?"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest ml-1">Mood del Viaggio</label>
        <div className="flex flex-wrap gap-2">
          {moods.map((m) => (
            <button
              key={m}
              onClick={() => setInput({ ...input, mood: m })}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                input.mood === m 
                ? 'bg-brand-accent text-brand-bg border-brand-accent shadow-lg shadow-brand-accent/20' 
                : 'bg-white/5 text-brand-text-dim border-white/10 hover:border-white/20'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest ml-1">Periodo</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Sun className="h-5 w-5 text-brand-accent" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none"
            placeholder="Es. Agosto, Primavera..."
            value={input.period}
            onChange={(e) => setInput({ ...input, period: e.target.value })}
          />
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={loading || !input.destination}
        className={`w-full py-5 rounded-2xl font-bold text-brand-bg transition-all flex items-center justify-center gap-3 ${
          loading || !input.destination 
          ? 'bg-white/10 text-white/30 cursor-not-allowed' 
          : 'bg-brand-accent hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-brand-accent/20'
        }`}
      >
        {loading ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Pianificazione in corso...</span>
          </>
        ) : (
          <>
            <Compass className="w-5 h-5" />
            <span>Crea il mio viaggio</span>
          </>
        )}
      </button>
    </motion.div>
  );
};
interface TripPlanDisplayProps {
  plan: TripPlan;
  weather?: WeatherData | null;
  onModify: (request: string) => void;
  onReset: () => void;
}

const TripPlanDisplay: React.FC<TripPlanDisplayProps> = ({ plan, weather, onModify, onReset }) => {
  const [modRequest, setModRequest] = useState('');
  const [expandedDay, setExpandedDay] = useState<number | null>(0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-20"
    >
      {/* Summary Card */}
      <div className="glass p-6 rounded-3xl border border-white/5 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-accent/10 rounded-2xl">
              <Compass className="w-6 h-6 text-brand-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{plan.summary.destination}</h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">
                  {plan.summary.duration} • {plan.summary.mood} • {plan.summary.period}
                </p>
                {weather && (
                  <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest bg-brand-accent/10 px-2 py-0.5 rounded-full">
                    {weather.temp}°C {weather.condition}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onReset}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-brand-text-dim"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Hotel className="w-3 h-3 text-brand-accent" />
              <span className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">Dove dormire</span>
            </div>
            <p className="text-sm font-bold text-white">{plan.summary.accommodationArea}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="w-3 h-3 text-brand-accent" />
              <span className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">Budget Totale</span>
            </div>
            <p className="text-sm font-bold text-white">{plan.summary.budgetTotal}</p>
          </div>
        </div>
      </div>

      {/* Days List */}
      <div className="space-y-4">
        {plan.days.map((day, idx) => (
          <div key={idx} className="space-y-3">
            <button
              onClick={() => setExpandedDay(expandedDay === idx ? null : idx)}
              className={`w-full glass p-5 rounded-2xl border transition-all flex items-center justify-between ${expandedDay === idx ? 'border-brand-accent/50 bg-brand-accent/5' : 'border-white/5'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center text-brand-accent font-bold">
                  {idx + 1}
                </div>
                <div className="text-left">
                  <h3 className="text-white font-bold">Giorno {idx + 1}</h3>
                  <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">
                    {day.activities.length} attività • {day.movementLevel}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-brand-text-dim transition-transform ${expandedDay === idx ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {expandedDay === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-3"
                >
                  {day.activities.map((act, aIdx) => (
                    <div key={aIdx} className="glass p-4 rounded-2xl border border-white/5 ml-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2 py-1 rounded-lg">
                            {act.time}
                          </span>
                          <h4 className="font-bold text-white">{act.place}</h4>
                        </div>
                        <span className="text-xs font-bold text-white/50">{act.price}</span>
                      </div>
                      
                      {/* Opening Hours Status */}
                      {(() => {
                        const status = getOpeningStatus(act.place, act.activity);
                        if (status.status !== 'open') return null;
                        return (
                          <div className="flex items-center gap-1.5 -mt-1">
                            <span className="text-[10px] font-bold text-green-400">
                              {status.message}
                            </span>
                            {status.detail && (
                              <span className="text-[9px] text-brand-text-dim/60 font-medium">
                                • {status.detail}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <p className="text-xs text-brand-text-dim leading-relaxed">
                        <span className="text-brand-accent font-bold uppercase tracking-tighter mr-2">{act.activity}</span>
                        {act.why}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">
                        <MapPin className="w-3 h-3" /> {act.zone}
                        <span>•</span>
                        <Clock className="w-3 h-3" /> {act.duration}
                      </div>
                    </div>
                  ))}
                  
                  <div className="p-4 bg-brand-accent/5 rounded-2xl border border-brand-accent/10 ml-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-brand-accent" />
                      <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">Highlight del giorno</span>
                    </div>
                    <p className="text-xs text-white/80 italic">"{day.highlight}"</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Practical Tips */}
      <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Info className="w-4 h-4 text-brand-accent" /> Consigli Pratici
        </h3>
        <ul className="space-y-3">
          {plan.practicalTips.map((tip, idx) => (
            <li key={idx} className="flex gap-3 text-xs text-brand-text-dim leading-relaxed">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-1.5 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Modification Section */}
      <div className="space-y-4">
        <p className="text-center text-[10px] font-bold text-brand-text-dim uppercase tracking-widest">Vuoi cambiare qualcosa?</p>
        <div className="glass p-4 rounded-3xl border border-white/5 flex gap-2">
          <input 
            type="text"
            placeholder="Es. Meno budget, più relax il giorno 2..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-brand-text-dim/50"
            value={modRequest}
            onChange={(e) => setModRequest(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && modRequest && onModify(modRequest)}
          />
          <button 
            onClick={() => modRequest && onModify(modRequest)}
            className="p-2 bg-brand-accent text-brand-bg rounded-xl hover:scale-105 transition-all"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button 
        onClick={onReset}
        className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-brand-text-dim hover:text-white transition-all"
      >
        Nuova pianificazione
      </button>
    </motion.div>
  );
};
