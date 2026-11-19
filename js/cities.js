/**
 * Predefined city shortcuts. WeatherAPI resolves a bare "Delhi" to Delhi,
 * Ontario, so popular-city queries are explicitly qualified with a country.
 */
export const POPULAR_CITIES = [
  { name: "Mumbai", country: "India", query: "Mumbai, India", aliases: [] },
  { name: "Delhi", country: "India", query: "Delhi, India", aliases: [] },
  { name: "Bengaluru", country: "India", query: "Bengaluru, India", aliases: ["Bangalore"] },
  { name: "Hyderabad", country: "India", query: "Hyderabad, India", aliases: [] },
  { name: "Chennai", country: "India", query: "Chennai, India", aliases: [] },
  { name: "Kolkata", country: "India", query: "Kolkata, India", aliases: ["Calcutta"] },
  { name: "Pune", country: "India", query: "Pune, India", aliases: [] },
  { name: "Ahmedabad", country: "India", query: "Ahmedabad, India", aliases: [] },
  { name: "New York", country: "United States", query: "New York, United States", aliases: ["USA", "US", "United States of America"] },
  { name: "London", country: "United Kingdom", query: "London, United Kingdom", aliases: ["UK", "Great Britain"] }
];

export const DEFAULT_CITY = POPULAR_CITIES[0];

const COUNTRY_ALIASES = {
  "india": ["in"],
  "united states": ["united states of america", "usa", "us"],
  "united kingdom": ["uk", "great britain", "england"],
  "united arab emirates": ["uae"],
  "south korea": ["korea", "republic of korea"],
  "north korea": ["democratic people's republic of korea"],
  "russia": ["russian federation"],
  "vietnam": ["viet nam"],
  "czechia": ["czech republic"],
  "turkey": ["türkiye", "turkiye"]
};

function normalise(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function countryMatches(apiCountry, cityCountry) {
  const left = normalise(apiCountry);
  const right = normalise(cityCountry);

  if (!left || !right) return false;
  if (left === right) return true;

  const rightAliases = COUNTRY_ALIASES[right] ?? [];
  const leftAliases = COUNTRY_ALIASES[left] ?? [];

  return rightAliases.includes(left) || leftAliases.includes(right);
}

/**
 * Turn a user-entered city into the query sent to WeatherAPI. Known city names
 * get a country qualifier to avoid ambiguous matches, while any other query is
 * passed through exactly as entered.
 */
export function resolveCityQuery(input) {
  const cleaned = String(input ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  const match = POPULAR_CITIES.find((city) => {
    const accepted = [
      city.name,
      `${city.name}, ${city.country}`,
      ...city.aliases.map((alias) => `${city.name}, ${alias}`)
    ].map(normalise);

    return accepted.includes(lower);
  });

  return match ? match.query : cleaned;
}

/**
 * Identify the popular-city shortcut represented by an API location.
 * Country matching prevents a "Delhi, Canada" search from selecting the
 * Delhi, India shortcut.
 */
export function findPopularCity(location) {
  if (!location?.name) return null;

  const name = normalise(location.name);
  return (
    POPULAR_CITIES.find(
      (city) => normalise(city.name) === name && countryMatches(location.country, city.country)
    ) ?? null
  );
}

export function getCountryLabel(country) {
  const value = String(country ?? "").trim();
  if (!value) return "";
  return value === "United States of America" ? "United States" : value;
}
