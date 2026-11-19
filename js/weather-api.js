export class WeatherRequestError extends Error {
  constructor(type, { status = 0, code = null, cause = null } = {}) {
    super(`Weather request failed: ${type}`, cause ? { cause } : undefined);
    this.name = "WeatherRequestError";
    this.type = type;
    this.status = status;
    this.code = code;
  }
}

function classifyFailure(status, payload) {
  const code = payload?.error?.code;
  const numericCode = Number(code);

  if (code === "PROXY_CONFIG" || numericCode === 1002 || numericCode === 1003) {
    return "configuration";
  }

  if (numericCode === 1006 || numericCode === 1004) {
    return "city";
  }

  if (numericCode === 2006 || numericCode === 2007 || numericCode === 2009) {
    return "configuration";
  }

  if (numericCode === 2008 || status === 429) {
    return "rateLimit";
  }

  if (code === "PROXY_TIMEOUT" || status === 504) {
    return "timeout";
  }

  if (code === "PROXY_NETWORK") {
    return "service";
  }

  if (status === 401 || status === 403) {
    return "configuration";
  }

  if (status >= 500) {
    return "service";
  }

  if (status === 400) {
    return "city";
  }

  return "unexpected";
}

function hasString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isValidPayload(data) {
  const location = data?.location;
  const current = data?.current;
  const condition = current?.condition;

  if (!location || !current || !condition) return false;

  const locationStrings = ["name", "country", "tz_id", "localtime"];
  const currentStrings = ["last_updated"];
  const conditionStrings = ["text", "icon"];
  const locationNumbers = ["localtime_epoch"];
  const currentNumbers = [
    "temp_c",
    "temp_f",
    "feelslike_c",
    "wind_kph",
    "humidity",
    "pressure_mb",
    "vis_km",
    "uv",
    "cloud",
    "last_updated_epoch"
  ];

  return (
    locationStrings.every((key) => hasString(location[key])) &&
    currentStrings.every((key) => hasString(current[key])) &&
    conditionStrings.every((key) => hasString(condition[key])) &&
    locationNumbers.every((key) => hasFiniteNumber(location[key])) &&
    currentNumbers.every((key) => hasFiniteNumber(current[key]))
  );
}

/**
 * Fetch live current weather through the same-origin Vercel proxy.
 * The WeatherAPI key stays in a server-side environment variable.
 */
export async function fetchWeather(city, { signal } = {}) {
  const endpoint = new URL("/api/weather", window.location.origin);
  endpoint.searchParams.set("q", city);

  let response;

  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new WeatherRequestError("network", { cause: error });
  }

  let raw = "";

  try {
    raw = await response.text();
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new WeatherRequestError("network", { cause: error });
  }

  let data = null;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new WeatherRequestError(response.ok ? "unexpected" : "service", {
      status: response.status
    });
  }

  if (!response.ok || data?.error) {
    const type = classifyFailure(response.status, data);
    throw new WeatherRequestError(type, {
      status: response.status,
      code: data?.error?.code ?? null
    });
  }

  if (!isValidPayload(data)) {
    throw new WeatherRequestError("unexpected", { status: response.status });
  }

  return { data, raw };
}
