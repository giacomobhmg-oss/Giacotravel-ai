import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, MapPin, Calendar, ArrowRight, ExternalLink, RefreshCw, AlertCircle, Clock, Euro } from 'lucide-react';
import { FlightInput, FlightOption } from '../types';
import { CityAutocomplete } from './CityAutocomplete';
import { searchFlights } from '../services/flightService';

export const FlightSearch: React.FC = () => {
  const [input, setInput] = useState<FlightInput>({
    origin: '',
    destination: '',
    departureDate: '',
    returnDate: '',
    tripType: 'Solo andata'
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    } catch (e) {
      return dateStr;
    }
  };

  const handleSearch = async () => {
    if (!input.origin || !input.destination || !input.departureDate) {
      setError('Compila tutti i campi obbligatori');
      return;
    }

    if (input.tripType === 'Andata e ritorno' && !input.returnDate) {
      setError('Inserisci la data di ritorno');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const flights = await searchFlights(input);
      setResults(flights);
      if (flights.length === 0) {
        setError('Nessun volo trovato per questa tratta e data.');
      }
    } catch (err) {
      console.error("Flight search error:", err);
      setError('Errore nella ricerca dei voli. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Search Form */}
      <div className="glass p-6 rounded-3xl border border-white/5 space-y-6">
        {/* Trip Type Selector */}
        <div className="flex p-1 bg-white/5 rounded-2xl w-fit">
          {(['Solo andata', 'Andata e ritorno'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setInput({ ...input, tripType: type })}
              className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                input.tripType === type 
                  ? 'bg-brand-accent text-brand-bg shadow-lg shadow-brand-accent/20' 
                  : 'text-brand-text-dim hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-3 h-3 text-brand-accent" /> Partenza
            </label>
            <CityAutocomplete
              value={input.origin}
              onChange={(val) => setInput({ ...input, origin: val })}
              placeholder="Città di partenza..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-3 h-3 text-brand-accent" /> Destinazione
            </label>
            <CityAutocomplete
              value={input.destination}
              onChange={(val) => setInput({ ...input, destination: val })}
              placeholder="Città di destinazione..."
            />
          </div>
        </div>

        <div className={`grid grid-cols-1 ${input.tripType === 'Andata e ritorno' ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4`}>
          <div className="space-y-2">
            <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-3 h-3 text-brand-accent" /> Data Partenza
            </label>
            <input
              type="date"
              className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all text-sm [color-scheme:dark]"
              value={input.departureDate}
              onChange={(e) => setInput({ ...input, departureDate: e.target.value })}
            />
          </div>
          {input.tripType === 'Andata e ritorno' && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-2"
            >
              <label className="text-xs font-bold text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-3 h-3 text-brand-accent" /> Data Ritorno
              </label>
              <input
                type="date"
                className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 text-white glow-focus transition-all text-sm [color-scheme:dark]"
                value={input.returnDate}
                onChange={(e) => setInput({ ...input, returnDate: e.target.value })}
              />
            </motion.div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-brand-accent text-brand-bg font-bold py-4 rounded-3xl flex items-center justify-center gap-3 transition-all text-lg shadow-lg shadow-brand-accent/20 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" /> Cerco voli...
            </>
          ) : (
            <>
              Cerca Voli <Plane className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 bg-red-400/10 p-5 rounded-3xl border border-red-400/20 text-red-400 text-sm font-medium"
        >
          <AlertCircle className="w-5 h-5" /> {error}
        </motion.div>
      )}

      {/* Results */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {results.map((flight, index) => (
            <motion.div
              key={`${flight.airline}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.1 }}
              className="glass p-6 rounded-3xl border border-white/5 hover:border-brand-accent/30 transition-all group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-brand-accent/10 transition-colors">
                    <Plane className="w-6 h-6 text-brand-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{flight.airline}</h3>
                    <div className="flex items-center gap-2 text-xs text-brand-text-dim font-medium uppercase tracking-widest">
                      <span>{flight.type}</span>
                      <span className="text-white/10">•</span>
                      <Clock className="w-3 h-3" /> {flight.duration}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 flex-1 justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{flight.departureTime}</p>
                    <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-tighter">{input.origin}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 max-w-[100px]">
                    <div className="w-full h-[1px] bg-white/10 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-bg px-2">
                        <Plane className="w-3 h-3 text-brand-text-dim/50" />
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{flight.arrivalTime}</p>
                    <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-tighter">{input.destination}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end gap-4">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-2xl font-bold text-brand-accent">
                      <Euro className="w-5 h-5" />
                      {flight.price.replace('€', '').trim()}
                    </div>
                    <p className="text-[10px] font-bold text-brand-text-dim uppercase tracking-widest mt-1 text-right">
                      {input.origin} → {input.destination} <br />
                      {formatDate(input.departureDate)}
                      {input.tripType === 'Andata e ritorno' && ` - ${formatDate(input.returnDate)}`}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[9px] font-bold text-brand-accent uppercase tracking-tighter bg-brand-accent/10 px-2 py-1 rounded-lg">
                      Ricerca pronta, inserisci solo conferma
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (flight.bookingUrl) {
                          window.open(flight.bookingUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="px-6 py-2 bg-white text-brand-bg rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-accent hover:text-brand-bg transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      Prenota <ExternalLink className="w-3 h-3" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
