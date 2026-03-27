export interface WeatherData {
  temp: number;
  condition: string;
  advice: string;
}

export async function fetchWeather(city: string): Promise<WeatherData | null> {
  if (!city || city.trim() === "") {
    console.warn("City name is empty.");
    return null;
  }

  try {
    // Using wttr.in with format=j1 for JSON output
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    );

    if (!response.ok) {
      console.warn(`Weather API failed for "${city}": ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.current_condition || !data.current_condition[0]) {
      console.warn("Invalid weather data received from wttr.in:", data);
      return null;
    }

    const current = data.current_condition[0];
    const temp = parseInt(current.temp_C);
    const description = current.lang_it?.[0]?.value || current.weatherDesc[0].value;
    const conditionLower = current.weatherDesc[0].value.toLowerCase();

    let advice = "Meteo ideale 🌤️";

    // Logic based on user request
    if (conditionLower.includes("rain") || conditionLower.includes("drizzle") || conditionLower.includes("shower")) {
      advice = "Porta un ombrello ☔";
    } else if (conditionLower.includes("snow") || temp < 10) {
      advice = "Copriti bene ❄️";
    } else if (conditionLower.includes("sun") || conditionLower.includes("clear") || temp > 25) {
      advice = "Giornata calda ☀️";
    }

    return {
      temp,
      condition: description,
      advice,
    };
  } catch (error) {
    console.error("Error fetching weather from wttr.in:", error);
    return null;
  }
}
