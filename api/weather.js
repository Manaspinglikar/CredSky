const WEATHER_API_ENDPOINT = "https://api.weatherapi.com/v1/current.json";
const UPSTREAM_TIMEOUT_MS = 8000;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only GET requests are supported."
      }
    });
  }

  let city = "";

  try {
    const requestUrl = new URL(req.url, "https://sky-cred.local");
    city = (requestUrl.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  } catch {
    city = "";
  }

  if (!city) {
    return res.status(400).json({
      error: {
        code: "INVALID_CITY",
        message: "A city query is required."
      }
    });
  }

  if (city.length > 80) {
    return res.status(400).json({
      error: {
        code: "INVALID_CITY",
        message: "The city query is too long."
      }
    });
  }

  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: {
        code: "PROXY_CONFIG",
        message: "WEATHER_API_KEY is not configured."
      }
    });
  }

  const upstreamUrl = new URL(WEATHER_API_ENDPOINT);
  upstreamUrl.searchParams.set("key", apiKey);
  upstreamUrl.searchParams.set("q", city);
  upstreamUrl.searchParams.set("aqi", "no");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "SKYCRED/1.0"
      },
      signal: controller.signal
    });

    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(body);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error("WeatherAPI proxy error:", timedOut ? "upstream timeout" : error?.name ?? "unknown");

    return res.status(timedOut ? 504 : 502).json({
      error: {
        code: timedOut ? "PROXY_TIMEOUT" : "PROXY_NETWORK",
        message: timedOut
          ? "WeatherAPI took too long to respond."
          : "WeatherAPI could not be reached."
      }
    });
  } finally {
    clearTimeout(timeout);
  }
};
