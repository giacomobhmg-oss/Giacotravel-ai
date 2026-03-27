
export type PlaceStatus = 'open' | 'closed' | 'unknown';

export interface OpeningStatus {
  status: PlaceStatus;
  message: string;
  detail?: string;
  alternative?: string;
}

const CATEGORIES = {
  RESTAURANT: {
    name: 'ristorante',
    hours: [
      { start: 12, end: 15 },
      { start: 19, end: 23 }
    ]
  },
  BAR: {
    name: 'bar',
    hours: [
      { start: 7, end: 20 }
    ]
  },
  MUSEUM: {
    name: 'museo',
    hours: [
      { start: 9, end: 18 }
    ]
  },
  NIGHTLIFE: {
    name: 'nightlife',
    hours: [
      { start: 22, end: 3 }
    ]
  },
  GENERIC: {
    name: 'generico',
    hours: [
      { start: 9, end: 19 }
    ]
  }
};

export function getOpeningStatus(place: string, activity: string): OpeningStatus {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour + currentMinute / 60;

  const text = (place + ' ' + activity).toLowerCase();
  
  let category = CATEGORIES.GENERIC;
  if (text.includes('ristorante') || text.includes('trattoria') || text.includes('pizzeria') || text.includes('osteria') || text.includes('cena') || text.includes('pranzo') || text.includes('mangiare')) {
    category = CATEGORIES.RESTAURANT;
  } else if (text.includes('bar') || text.includes('caffè') || text.includes('colazione') || text.includes('aperitivo')) {
    category = CATEGORIES.BAR;
  } else if (text.includes('museo') || text.includes('galleria') || text.includes('mostra') || text.includes('chiesa') || text.includes('monumento')) {
    category = CATEGORIES.MUSEUM;
  } else if (text.includes('club') || text.includes('disco') || text.includes('lounge') || text.includes('cocktail') || text.includes('ballare')) {
    category = CATEGORIES.NIGHTLIFE;
  }

  const isOpen = category.hours.some(h => {
    if (h.start < h.end) {
      return currentTime >= h.start && currentTime < h.end;
    } else {
      // Overnight hours (e.g. 22:00 to 03:00)
      return currentTime >= h.start || currentTime < h.end;
    }
  });

  if (isOpen) {
    const currentRange = category.hours.find(h => {
      if (h.start < h.end) return currentTime >= h.start && currentTime < h.end;
      return currentTime >= h.start || currentTime < h.end;
    })!;

    // Calculate hours remaining
    let hoursLeft;
    if (currentRange.end > currentTime) {
      hoursLeft = currentRange.end - currentTime;
    } else {
      // Overnight case
      hoursLeft = (currentRange.end + 24) - currentTime;
    }

    const detail = hoursLeft <= 2 
      ? `Chiude tra ${Math.ceil(hoursLeft)}h` 
      : `Chiude alle ${String(currentRange.end).padStart(2, '0')}:00`;

    return { 
      status: 'open', 
      message: '🟢 Aperto ora', 
      detail
    };
  } else {
    // Find when it opens next
    // Sort hours to find the next one
    const sortedHours = [...category.hours].sort((a, b) => a.start - b.start);
    const nextRange = sortedHours.find(h => h.start > currentTime) || sortedHours[0];
    
    return { 
      status: 'closed', 
      message: '🔴 Chiuso ora', 
      detail: `Apre alle ${String(nextRange.start).padStart(2, '0')}:00`
    };
  }
}
