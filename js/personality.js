/**
 * Weather personality rules.
 *
 * Priority order matters when conditions overlap:
 * storm > snow > rain > very cold > very hot > windy > pleasant > warm > cool > mixed.
 * A rainy 38°C day therefore gets "Rain Check", not "Sun Alert", because rain
 * changes the immediate action more than heat does.
 */
const PERSONALITY_RULES = [
  {
    id: "storm",
    tone: "storm",
    test: ({ condition }) => /thunder|storm/i.test(condition),
    title: "Storm Chaser",
    copy: "Thunder is in the air. Better to wait this one out indoors.",
    stamp: "Stay in"
  },
  {
    id: "snow",
    tone: "snow",
    test: ({ condition }) => /snow|sleet|blizzard|ice|freez/i.test(condition),
    title: "Snow Day",
    copy: "Cold and slippery out there. Layer up and watch your step.",
    stamp: "Layer up"
  },
  {
    id: "rain",
    tone: "rain",
    test: ({ condition }) => /rain|drizzle|shower/i.test(condition),
    title: "Rain Check",
    copy: "Carry an umbrella before stepping out.",
    stamp: "Take cover"
  },
  {
    id: "freeze",
    tone: "cold",
    test: ({ temp }) => temp <= 10,
    title: "Freeze Frame",
    copy: "Bone-chilling cold. Bundle up tight.",
    stamp: "Bundle up"
  },
  {
    id: "sun",
    tone: "sun",
    test: ({ temp }) => temp >= 35,
    title: "Sun Alert",
    copy: "Stay hydrated and avoid excessive sun exposure.",
    stamp: "Hydrate"
  },
  {
    id: "wind",
    tone: "wind",
    test: ({ wind }) => wind >= 30,
    title: "Breezy Mode",
    copy: "Expect strong winds. Dress accordingly.",
    stamp: "Hold on"
  },
  {
    id: "perfect",
    tone: "go",
    test: ({ temp, humidity }) => temp >= 18 && temp <= 30 && humidity <= 85,
    title: "Perfect Day",
    copy: "Great weather to step outside.",
    stamp: "Good to go"
  },
  {
    id: "warm",
    tone: "warm",
    test: ({ temp }) => temp > 30 && temp < 35,
    title: "Warm Glow",
    copy: "A warm one. Keep water close and take it easy in the sun.",
    stamp: "Hydrate"
  },
  {
    id: "cool",
    tone: "cool",
    test: ({ temp }) => temp > 10 && temp < 18,
    title: "Light Layer",
    copy: "Crisp air. A light jacket will do.",
    stamp: "Layer up"
  },
  {
    id: "mixed",
    tone: "mixed",
    test: () => true,
    title: "Take It Slow",
    copy: "A mixed bag out there. Check the numbers and dress for the day.",
    stamp: "Check in"
  }
];

export function getWeatherPersonality(current) {
  const facts = {
    temp: Number(current?.temp_c),
    wind: Number(current?.wind_kph),
    humidity: Number(current?.humidity),
    condition: String(current?.condition?.text ?? "")
  };

  const rule = PERSONALITY_RULES.find((candidate) => candidate.test(facts));

  return {
    id: rule.id,
    tone: rule.tone,
    title: rule.title,
    copy: rule.copy,
    stamp: rule.stamp
  };
}

/**
 * Pick a restrained visual theme for the weather card from the API condition.
 * This affects decoration only; all displayed values still come from WeatherAPI.
 */
export function getWeatherTheme(current) {
  const condition = String(current?.condition?.text ?? "");

  if (/thunder|storm/i.test(condition)) return "storm";
  if (/snow|sleet|blizzard|ice|freez/i.test(condition)) return "snow";
  if (/rain|drizzle|shower/i.test(condition)) return "rain";
  if (/cloud|overcast|mist|fog|haze|smoke|dust|sand/i.test(condition)) return "cloud";

  return Number(current?.is_day) === 1 ? "clear" : "night";
}
