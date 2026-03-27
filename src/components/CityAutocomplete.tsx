import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Search } from 'lucide-react';
import { CITIES, CitySuggestion } from '../constants/cities';

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({ value, onChange, placeholder }) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFilteredCities = (search: string) => {
    if (!search || search.length < 2) return [];
    
    const lowerSearch = search.toLowerCase();
    
    return CITIES
      .filter(city => 
        city.name.toLowerCase().includes(lowerSearch) || 
        city.country.toLowerCase().includes(lowerSearch)
      )
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // Priority 1: Starts with search
        const aStarts = aName.startsWith(lowerSearch);
        const bStarts = bName.startsWith(lowerSearch);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Priority 2: Popularity
        return b.popularity - a.popularity;
      })
      .slice(0, 5);
  };

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const filtered = getFilteredCities(val);
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
      setSelectedIndex(0);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          selectCity(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const selectCity = (city: CitySuggestion) => {
    const selection = city.name;
    setQuery(selection);
    onChange(selection);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full">
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="w-full bg-brand-bg/50 border border-white/5 rounded-2xl px-4 py-3 pl-10 text-white glow-focus transition-all placeholder:text-brand-text-dim/50 text-sm"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const filtered = getFilteredCities(query);
            if (filtered.length > 0) {
              setSuggestions(filtered);
              setIsOpen(true);
            }
          }}
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text-dim group-focus-within:text-brand-accent transition-colors">
          <Search className="w-4 h-4" />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 w-full mt-2 glass rounded-2xl overflow-hidden card-shadow border border-white/10"
          >
            <div className="py-2">
              {suggestions.map((city, index) => (
                <button
                  key={`${city.name}-${city.country}`}
                  onClick={() => selectCity(city)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
                    index === selectedIndex ? 'bg-brand-accent/10 text-brand-accent' : 'text-brand-text hover:bg-white/5'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${index === selectedIndex ? 'bg-brand-accent/20' : 'bg-white/5'}`}>
                    <MapPin className={`w-4 h-4 ${index === selectedIndex ? 'text-brand-accent' : 'text-brand-text-dim'}`} />
                  </div>
                  <div>
                    <p className="font-semibold">{city.name}</p>
                    <p className="text-xs text-brand-text-dim">{city.country}</p>
                  </div>
                  {index === selectedIndex && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="ml-auto"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
