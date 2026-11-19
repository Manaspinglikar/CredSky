import { getCountryLabel } from "./cities.js";
import {
  formatBytes,
  formatDate,
  formatDecimal,
  formatInteger,
  formatRelativeTime,
  formatReportNumber,
  formatTime,
  formatTimeZoneName,
  getByteSize
} from "./formatters.js";

const EMPTY_JSON_MESSAGE = [
  "// No successful API response yet.",
  "// Live weather JSON will appear here after Mumbai loads."
].join("\n");

function byId(id) {
  return document.getElementById(id);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildHighlightedJson(json) {
  const fragment = document.createDocumentFragment();
  const tokenPattern =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(json)) !== null) {
    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(json.slice(lastIndex, match.index)));
    }

    const token = document.createElement("span");
    const value = match[0];

    if (match[1] !== undefined) {
      token.className = match[2] ? "json-key" : "json-string";
    } else if (value === "true" || value === "false") {
      token.className = "json-boolean";
    } else if (value === "null") {
      token.className = "json-null";
    } else {
      token.className = "json-number";
    }

    token.textContent = value;
    fragment.append(token);
    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < json.length) {
    fragment.append(document.createTextNode(json.slice(lastIndex)));
  }

  return fragment;
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the selection-based fallback.
    }
  }

  const helper = document.createElement("textarea");
  helper.className = "clipboard-helper";
  helper.value = text;
  helper.setAttribute("readonly", "");
  document.body.append(helper);
  helper.select();

  const copied = document.execCommand("copy");
  helper.remove();

  if (!copied) throw new Error("Clipboard copy failed");
}

function humidityReading(value) {
  if (value <= 30) {
    return { note: "Dry", caption: "Dry air. Keep some water close." };
  }
  if (value <= 60) {
    return { note: "Comfortable", caption: "Comfortable moisture in the air." };
  }
  return { note: "Humid", caption: "Feels muggy out there. Keep it light." };
}

function windReading(value) {
  if (value < 12) {
    return { note: "Calm", caption: "Barely a stir in the air." };
  }
  if (value < 30) {
    return { note: "Breezy", caption: "A noticeable breeze is moving through." };
  }
  return { note: "Windy", caption: "Strong winds. Secure loose layers." };
}

function uvReading(value) {
  if (value <= 2) {
    return { note: "Low", caption: "Low UV. Minimal protection needed." };
  }
  if (value <= 5) {
    return { note: "Moderate", caption: "Moderate UV. Consider sunscreen." };
  }
  if (value <= 7) {
    return { note: "High", caption: "High UV. Sunscreen is a good idea." };
  }
  if (value <= 10) {
    return { note: "Very high", caption: "Very high UV. Limit midday sun." };
  }
  return { note: "Extreme", caption: "Extreme UV. Stay in the shade." };
}

function safeIconUrl(icon) {
  const raw = String(icon ?? "").trim();
  const secure = raw.startsWith("//") ? `https:${raw}` : raw.replace(/^http:/i, "https:");
  const highResolution = secure.replace("/64x64/", "/128x128/");
  return /^https:\/\/cdn\.weatherapi\.com\//i.test(highResolution) ? highResolution : "";
}

export class WeatherUI {
  constructor({ onSelectCity, onRetry }) {
    this.onSelectCity = onSelectCity;
    this.onRetry = onRetry;
    this.currentView = "formatted";
    this.jsonFormatted = "";
    this.jsonRaw = "";
    this.hasPayload = false;
    this.timeZone = null;
    this.lastUpdatedEpoch = null;
    this.copyTimer = null;
    this.toastTimer = null;

    this.el = {
      headerLocation: byId("headerLocation"),
      headerTime: byId("headerTime"),
      searchForm: byId("searchForm"),
      cityInput: byId("cityInput"),
      searchButton: byId("searchButton"),
      buttonLabel: document.querySelector("#searchButton .button-label"),
      searchError: byId("searchError"),
      popularCities: byId("popularCities"),
      loadingTrack: byId("loadingTrack"),
      errorBanner: byId("errorBanner"),
      errorTitle: byId("errorTitle"),
      errorMessage: byId("errorMessage"),
      errorContext: byId("errorContext"),
      retryButton: byId("retryButton"),
      globalStatus: byId("globalStatus"),
      dashboard: byId("dashboard"),
      weatherCard: byId("weatherCard"),
      cityLabel: byId("cityLabel"),
      countryCode: byId("countryCode"),
      regionName: byId("regionName"),
      weatherStatusText: byId("weatherStatusText"),
      tempValue: byId("tempValue"),
      feelsLike: byId("feelsLike"),
      conditionIcon: byId("conditionIcon"),
      conditionText: byId("conditionText"),
      localTime: byId("localTime"),
      localDate: byId("localDate"),
      lastUpdated: byId("lastUpdated"),
      updatedAgo: byId("updatedAgo"),
      timeZone: byId("timeZone"),
      timeZoneName: byId("timeZoneName"),
      verdictCard: byId("verdictCard"),
      reportNumber: byId("reportNumber"),
      personalityTitle: byId("personalityTitle"),
      personalityCopy: byId("personalityCopy"),
      verdictStamp: byId("verdictStamp"),
      personalityBasis: byId("personalityBasis"),
      humidityValue: byId("humidityValue"),
      humidityNote: byId("humidityNote"),
      humidityCaption: byId("humidityCaption"),
      humidityBar: byId("humidityBar"),
      windValue: byId("windValue"),
      windNote: byId("windNote"),
      windCaption: byId("windCaption"),
      windBar: byId("windBar"),
      uvValue: byId("uvValue"),
      uvNote: byId("uvNote"),
      uvCaption: byId("uvCaption"),
      uvBar: byId("uvBar"),
      cloudValue: byId("cloudValue"),
      visibilityValue: byId("visibilityValue"),
      pressureValue: byId("pressureValue"),
      windDetailValue: byId("windDetailValue"),
      fahrenheitValue: byId("fahrenheitValue"),
      lastUpdatedDetail: byId("lastUpdatedDetail"),
      formattedTab: byId("formattedTab"),
      rawTab: byId("rawTab"),
      jsonPanel: byId("jsonPanel"),
      jsonContent: byId("jsonContent"),
      copyButton: byId("copyButton"),
      copyLabel: byId("copyLabel"),
      payloadStatus: byId("payloadStatus"),
      jsonSize: byId("jsonSize"),
      toast: byId("toast")
    };

    this.bindEvents();
    this.renderJson();
    this.updateCopyLabel();
    this.clockTimer = window.setInterval(() => this.updateClock(), 30_000);
  }

  bindEvents() {
    this.el.retryButton.addEventListener("click", () => this.onRetry());

    this.el.formattedTab.addEventListener("click", () => this.setJsonView("formatted"));
    this.el.rawTab.addEventListener("click", () => this.setJsonView("raw"));

    [this.el.formattedTab, this.el.rawTab].forEach((tab) => {
      tab.addEventListener("keydown", (event) => this.handleTabKeydown(event));
    });

    this.el.copyButton.addEventListener("click", () => this.copyJson());

    this.el.conditionIcon.addEventListener("error", () => {
      this.el.conditionIcon.hidden = true;
      this.el.conditionIcon.removeAttribute("src");
    });
  }

  renderPopularCities(cities) {
    const buttons = cities.map((city) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.city = city.name;
      button.textContent = city.name;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Show current weather for ${city.name}, ${city.country}`);
      button.addEventListener("click", () => this.onSelectCity(city));
      return button;
    });

    this.el.popularCities.replaceChildren(...buttons);
  }

  setActiveCity(cityName) {
    this.el.popularCities.querySelectorAll(".chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(chip.dataset.city === cityName));
    });
  }

  setSearchValue(value) {
    this.el.cityInput.value = value;
  }

  getSearchValue() {
    return this.el.cityInput.value;
  }

  focusSearch() {
    this.el.cityInput.focus();
  }

  setSearchError(message) {
    this.el.searchError.textContent = message;
    this.el.searchError.hidden = false;
    this.el.searchForm.classList.add("has-error");
    this.el.cityInput.setAttribute("aria-invalid", "true");
  }

  clearSearchError() {
    this.el.searchError.textContent = "";
    this.el.searchError.hidden = true;
    this.el.searchForm.classList.remove("has-error");
    this.el.cityInput.removeAttribute("aria-invalid");
  }

  setLoading(isLoading, { hasData = false } = {}) {
    this.el.loadingTrack.hidden = !isLoading;
    this.el.searchButton.classList.toggle("is-loading", isLoading);
    this.el.searchButton.setAttribute("aria-busy", String(isLoading));
    this.el.buttonLabel.textContent = isLoading ? "Checking…" : "Check the sky";
    this.el.dashboard.setAttribute("aria-busy", String(isLoading));

    if (isLoading) {
      this.el.weatherCard.classList.remove("has-error");
      this.el.weatherCard.classList.toggle("is-refreshing", hasData);
      this.el.weatherCard.classList.toggle("is-loading", !hasData);
      this.el.weatherStatusText.textContent = hasData ? "Updating" : "Connecting";
    } else {
      this.el.weatherCard.classList.remove("is-refreshing", "is-loading");
    }
  }

  renderSuccess({ data, raw, personality, theme }) {
    const { location, current } = data;
    const country = getCountryLabel(location.country);
    const localEpoch = Date.now() / 1000;

    this.el.weatherCard.classList.remove("is-loading", "is-refreshing", "has-error");
    this.el.verdictCard.classList.remove("is-loading");
    this.el.errorBanner.hidden = true;
    this.clearSearchError();

    this.el.weatherCard.dataset.theme = theme;
    this.el.weatherCard.dataset.city = location.name;
    this.el.weatherStatusText.textContent = "Live";
    this.el.cityLabel.textContent = location.name;
    this.el.countryCode.textContent = country;
    this.el.countryCode.title = location.country;
    this.el.regionName.textContent = location.region || country;
    this.el.headerLocation.textContent = `${location.name}, ${country}`;

    this.el.tempValue.textContent = formatDecimal(current.temp_c, 1);
    this.el.feelsLike.textContent = `${formatDecimal(current.feelslike_c, 1)}°C`;
    this.el.conditionText.textContent = current.condition.text;

    const iconUrl = safeIconUrl(current.condition.icon);
    if (iconUrl) {
      this.el.conditionIcon.alt = `${current.condition.text} weather icon`;
      this.el.conditionIcon.src = iconUrl;
      this.el.conditionIcon.hidden = false;
    } else {
      this.el.conditionIcon.hidden = true;
      this.el.conditionIcon.removeAttribute("src");
      this.el.conditionIcon.alt = "";
    }

    this.timeZone = location.tz_id;
    this.lastUpdatedEpoch = current.last_updated_epoch;

    this.el.localTime.textContent = formatTime(localEpoch, this.timeZone);
    this.el.localDate.textContent = formatDate(localEpoch, this.timeZone);
    this.el.lastUpdated.textContent = formatTime(current.last_updated_epoch, this.timeZone);
    this.el.updatedAgo.textContent = formatRelativeTime(current.last_updated_epoch);
    this.el.timeZone.textContent = this.timeZone;
    this.el.timeZoneName.textContent = formatTimeZoneName(localEpoch, this.timeZone);
    this.el.reportNumber.textContent = formatReportNumber(localEpoch, this.timeZone);

    this.el.verdictCard.dataset.tone = personality.tone;
    this.el.verdictCard.dataset.personality = personality.id;
    this.el.personalityTitle.textContent = personality.title;
    this.el.personalityCopy.textContent = personality.copy;
    this.el.verdictStamp.textContent = personality.stamp;
    this.el.personalityBasis.textContent =
      `${formatDecimal(current.temp_c, 1)}°C · ${current.condition.text} · ` +
      `${formatDecimal(current.wind_kph, 1)} km/h wind`;

    this.renderMetrics(current);
    this.renderDetails(current, this.timeZone);
    this.setJsonPayload(data, raw);

    document.title = `${location.name} — SKY CRED`;
    this.updateClock();
  }

  renderMetrics(current) {
    const humidity = clamp(Number(current.humidity), 0, 100);
    const wind = Math.max(0, Number(current.wind_kph));
    const uv = Math.max(0, Number(current.uv));
    const humidityInfo = humidityReading(humidity);
    const windInfo = windReading(wind);
    const uvInfo = uvReading(uv);

    this.el.humidityValue.textContent = formatInteger(current.humidity);
    this.el.humidityNote.textContent = humidityInfo.note;
    this.el.humidityCaption.textContent = humidityInfo.caption;
    this.el.humidityBar.style.width = `${humidity}%`;

    this.el.windValue.textContent = formatDecimal(current.wind_kph, 1);
    this.el.windNote.textContent = windInfo.note;
    const gust = Number(current.gust_kph);
    this.el.windCaption.textContent = Number.isFinite(gust)
      ? `${windInfo.caption} Gusts up to ${formatDecimal(gust, 1)} km/h.`
      : windInfo.caption;
    this.el.windBar.style.width = `${clamp((wind / 60) * 100, 0, 100)}%`;

    this.el.uvValue.textContent = formatDecimal(current.uv, 1);
    this.el.uvNote.textContent = uvInfo.note;
    this.el.uvCaption.textContent = uvInfo.caption;
    this.el.uvBar.style.width = `${clamp((uv / 11) * 100, 0, 100)}%`;
  }

  renderDetails(current, timeZone) {
    const windDirection = String(current.wind_dir ?? "").trim();
    const updatedTime = formatTime(current.last_updated_epoch, timeZone);
    const updatedDate = formatDate(current.last_updated_epoch, timeZone);

    this.el.cloudValue.textContent = `${formatInteger(current.cloud)}%`;
    this.el.visibilityValue.textContent = `${formatDecimal(current.vis_km, 1)} km`;
    this.el.pressureValue.textContent = `${formatInteger(current.pressure_mb)} mb`;
    this.el.windDetailValue.textContent =
      `${formatDecimal(current.wind_kph, 1)} km/h${windDirection ? ` ${windDirection}` : ""}`;
    this.el.fahrenheitValue.textContent = `${formatDecimal(current.temp_f, 1)}°F`;
    this.el.lastUpdatedDetail.textContent = `${updatedTime} · ${updatedDate}`;
  }

  setJsonPayload(data, raw) {
    this.jsonFormatted = JSON.stringify(data, null, 2);
    this.jsonRaw = raw;
    this.hasPayload = true;
    this.el.payloadStatus.textContent = "Live payload";
    this.el.jsonSize.textContent = formatBytes(getByteSize(raw));
    this.el.copyButton.disabled = false;
    this.el.jsonPanel.scrollTop = 0;
    this.el.jsonPanel.scrollLeft = 0;
    this.renderJson();
  }

  renderJson() {
    this.el.jsonContent.classList.toggle("json-placeholder", !this.hasPayload);

    if (!this.hasPayload) {
      this.el.jsonContent.textContent = EMPTY_JSON_MESSAGE;
      return;
    }

    if (this.currentView === "raw") {
      this.el.jsonContent.textContent = this.jsonRaw;
      return;
    }

    this.el.jsonContent.replaceChildren(buildHighlightedJson(this.jsonFormatted));
  }

  setJsonView(view, { focus = false } = {}) {
    if (view !== "formatted" && view !== "raw") return;

    this.currentView = view;
    const isFormatted = view === "formatted";

    this.el.formattedTab.setAttribute("aria-selected", String(isFormatted));
    this.el.formattedTab.tabIndex = isFormatted ? 0 : -1;
    this.el.rawTab.setAttribute("aria-selected", String(!isFormatted));
    this.el.rawTab.tabIndex = isFormatted ? -1 : 0;
    this.el.jsonPanel.setAttribute("aria-labelledby", isFormatted ? "formattedTab" : "rawTab");

    this.resetCopyFeedback();
    this.updateCopyLabel();
    this.renderJson();

    if (focus) {
      (isFormatted ? this.el.formattedTab : this.el.rawTab).focus();
    }
  }

  handleTabKeydown(event) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    const tabs = [this.el.formattedTab, this.el.rawTab];
    const currentIndex = tabs.indexOf(document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft") nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
    if (event.key === "ArrowRight") nextIndex = currentIndex >= tabs.length - 1 ? 0 : currentIndex + 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    this.setJsonView(tabs[nextIndex] === this.el.rawTab ? "raw" : "formatted", { focus: true });
  }

  updateCopyLabel() {
    const isRaw = this.currentView === "raw";
    this.el.copyLabel.textContent = isRaw ? "Copy raw" : "Copy JSON";
    this.el.copyButton.setAttribute(
      "aria-label",
      isRaw ? "Copy raw JSON to clipboard" : "Copy JSON (formatted) to clipboard"
    );
  }

  async copyJson() {
    if (!this.hasPayload) {
      this.showToast("Nothing to copy yet. Load a city first.");
      return;
    }

    const isRaw = this.currentView === "raw";
    const text = isRaw ? this.jsonRaw : this.jsonFormatted;

    try {
      await writeToClipboard(text);
    } catch {
      this.showToast("Copy failed. Select the JSON and copy it manually.");
      return;
    }

    this.el.copyButton.classList.add("is-copied");
    this.el.copyLabel.textContent = "Copied";
    this.el.copyButton.setAttribute("aria-label", "Copied to clipboard");
    this.el.copyButton.querySelector("use")?.setAttribute("href", "#icon-check");
    this.showToast(`${isRaw ? "Raw" : "Formatted"} JSON copied to clipboard.`);

    window.clearTimeout(this.copyTimer);
    this.copyTimer = window.setTimeout(() => this.resetCopyFeedback(), 1800);
  }

  resetCopyFeedback() {
    window.clearTimeout(this.copyTimer);
    this.el.copyButton.classList.remove("is-copied");
    this.el.copyButton.querySelector("use")?.setAttribute("href", "#icon-copy");
    this.updateCopyLabel();
  }

  showToast(message) {
    window.clearTimeout(this.toastTimer);
    this.el.toast.textContent = message;
    this.el.toast.classList.add("is-visible");
    this.toastTimer = window.setTimeout(() => {
      this.el.toast.classList.remove("is-visible");
    }, 2800);
  }

  showError(presentation, { hasData = false, lastCity = "", attemptedCity = "" } = {}) {
    this.el.errorBanner.hidden = false;
    this.el.errorTitle.textContent = presentation.title;
    this.el.errorMessage.textContent = presentation.message;
    this.el.retryButton.hidden = !presentation.canRetry;

    if (hasData) {
      this.el.errorContext.textContent = lastCity
        ? `Showing the last successful report for ${lastCity}.`
        : "Showing the last successful report.";
      this.el.weatherCard.classList.add("has-error");
      this.el.weatherStatusText.textContent = "Last check";
      return;
    }

    this.el.errorContext.textContent = "No live weather data was loaded.";
    this.renderNoDataState(attemptedCity);
  }

  renderNoDataState(attemptedCity) {
    this.timeZone = null;
    this.lastUpdatedEpoch = null;

    this.el.weatherCard.classList.remove("is-loading", "is-refreshing");
    this.el.weatherCard.classList.add("has-error");
    this.el.verdictCard.classList.remove("is-loading");
    this.el.weatherCard.dataset.theme = "night";
    this.el.weatherStatusText.textContent = "No data";

    if (attemptedCity) {
      this.el.cityLabel.textContent = attemptedCity;
      this.el.headerLocation.textContent = attemptedCity;
    }

    this.el.countryCode.textContent = "—";
    this.el.regionName.textContent = "No current conditions available";
    this.el.tempValue.textContent = "--";
    this.el.feelsLike.textContent = "--";
    this.el.conditionText.textContent = "Live data unavailable";
    this.el.conditionIcon.hidden = true;
    this.el.conditionIcon.removeAttribute("src");
    this.el.conditionIcon.alt = "";

    this.el.localTime.textContent = "—";
    this.el.localDate.textContent = "—";
    this.el.lastUpdated.textContent = "—";
    this.el.updatedAgo.textContent = "—";
    this.el.timeZone.textContent = "—";
    this.el.timeZoneName.textContent = "—";
    this.el.headerTime.textContent = "--:--";
    this.el.reportNumber.textContent = "No. —";

    this.el.verdictCard.dataset.tone = "mixed";
    this.el.verdictCard.dataset.personality = "none";
    this.el.personalityTitle.textContent = "Sky’s on hold";
    this.el.personalityCopy.textContent =
      "We couldn’t get a current read. Retry when you’re ready.";
    this.el.verdictStamp.textContent = "No read";
    this.el.personalityBasis.textContent = "Waiting for a successful API response.";

    this.el.humidityValue.textContent = "--";
    this.el.humidityNote.textContent = "—";
    this.el.humidityCaption.textContent = "Awaiting live data.";
    this.el.humidityBar.style.width = "0%";

    this.el.windValue.textContent = "--";
    this.el.windNote.textContent = "—";
    this.el.windCaption.textContent = "Awaiting live data.";
    this.el.windBar.style.width = "0%";

    this.el.uvValue.textContent = "--";
    this.el.uvNote.textContent = "—";
    this.el.uvCaption.textContent = "Awaiting live data.";
    this.el.uvBar.style.width = "0%";

    [
      this.el.cloudValue,
      this.el.visibilityValue,
      this.el.pressureValue,
      this.el.windDetailValue,
      this.el.fahrenheitValue,
      this.el.lastUpdatedDetail
    ].forEach((element) => {
      element.textContent = "—";
    });

    document.title = "Weather unavailable — SKY CRED";
  }

  clearError() {
    this.el.errorBanner.hidden = true;
    this.el.weatherCard.classList.remove("has-error");
  }

  announce(message) {
    this.el.globalStatus.textContent = "";
    window.setTimeout(() => {
      this.el.globalStatus.textContent = message;
    }, 20);
  }

  updateClock() {
    if (!this.timeZone) return;

    const now = Date.now() / 1000;
    const localTime = formatTime(now, this.timeZone);
    this.el.localTime.textContent = localTime;
    this.el.localDate.textContent = formatDate(now, this.timeZone);
    this.el.headerTime.textContent = localTime;

    if (Number.isFinite(Number(this.lastUpdatedEpoch))) {
      this.el.updatedAgo.textContent = formatRelativeTime(this.lastUpdatedEpoch);
    }
  }
}
