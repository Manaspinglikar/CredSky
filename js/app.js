import { DEFAULT_CITY, POPULAR_CITIES, findPopularCity, resolveCityQuery } from "./cities.js";
import { getErrorPresentation } from "./errors.js";
import { formatDecimal } from "./formatters.js";
import { getWeatherPersonality, getWeatherTheme } from "./personality.js";
import { WeatherUI } from "./ui.js";
import { fetchWeather } from "./weather-api.js";

const state = {
  data: null,
  raw: "",
  lastSuccessfulCity: "",
  status: "idle",
  requestId: 0,
  controller: null,
  lastAttempt: null
};

const ui = new WeatherUI({
  onSelectCity: (city) => {
    ui.setSearchValue(city.name);
    search(city.name, {
      source: "popular",
      queryOverride: city.query
    });
  },
  onRetry: () => {
    if (!state.lastAttempt) {
      search(ui.getSearchValue(), { source: "retry" });
      return;
    }

    ui.setSearchValue(state.lastAttempt.displayCity);
    search(state.lastAttempt.displayCity, {
      source: "retry",
      queryOverride: state.lastAttempt.query
    });
  }
});

ui.renderPopularCities(POPULAR_CITIES);

document.getElementById("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  search(ui.getSearchValue(), { source: "search" });
});

document.getElementById("cityInput").addEventListener("input", () => {
  ui.clearSearchError();
});

async function search(input, { source = "search", queryOverride = null } = {}) {
  const displayCity = String(input ?? "").trim().replace(/\s+/g, " ");

  if (!displayCity) {
    ui.setSearchError("Enter a city to check the sky.");
    ui.announce("Enter a city to check the sky.");
    ui.focusSearch();
    return;
  }

  ui.setSearchValue(displayCity);
  ui.clearSearchError();

  const query = queryOverride ?? resolveCityQuery(displayCity);

  state.controller?.abort();
  const controller = new AbortController();
  const requestId = ++state.requestId;

  state.controller = controller;
  state.lastAttempt = { displayCity, query };
  state.status = "loading";

  ui.setLoading(true, { hasData: Boolean(state.data) });
  ui.clearError();
  ui.announce(
    `${source === "retry" ? "Retrying" : "Checking"} the sky in ${displayCity}…`
  );

  try {
    const { data, raw } = await fetchWeather(query, { signal: controller.signal });

    if (requestId !== state.requestId) return;

    const personality = getWeatherPersonality(data.current);
    const theme = getWeatherTheme(data.current);

    state.data = data;
    state.raw = raw;
    state.lastSuccessfulCity = data.location.name;
    state.status = "success";

    ui.renderSuccess({ data, raw, personality, theme });
    ui.setActiveCity(findPopularCity(data.location)?.name ?? null);
    ui.clearError();
    ui.setLoading(false, { hasData: true });
    ui.announce(
      `${data.location.name}: ${formatDecimal(data.current.temp_c, 1)} degrees Celsius, ` +
        `${data.current.condition.text}. ${personality.title}. ${personality.copy}`
    );
  } catch (error) {
    if (error?.name === "AbortError" || requestId !== state.requestId) return;

    state.status = "error";
    const presentation = getErrorPresentation(error, displayCity);
    const hasData = Boolean(state.data);

    ui.setLoading(false, { hasData });
    ui.showError(presentation, {
      hasData,
      lastCity: state.lastSuccessfulCity,
      attemptedCity: displayCity
    });
    ui.setActiveCity(
      state.data ? findPopularCity(state.data.location)?.name ?? null : null
    );
    ui.announce(`${presentation.title}. ${presentation.message}`);
  } finally {
    if (requestId === state.requestId) {
      state.controller = null;
      ui.setLoading(false, { hasData: Boolean(state.data) });
    }
  }
}

search(DEFAULT_CITY.name, {
  source: "initial",
  queryOverride: DEFAULT_CITY.query
});
