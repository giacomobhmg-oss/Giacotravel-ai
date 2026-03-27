import { FlightInput, FlightOption } from "../types";

export async function searchFlights(input: FlightInput): Promise<FlightOption[]> {
  try {
    const response = await fetch("/api/flights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch flights from API");
    }

    return await response.json();
  } catch (error) {
    console.error("Error searching flights via API:", error);
    throw error;
  }
}
