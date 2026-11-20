# SKY CRED

SKY CRED turns live WeatherAPI data into a plain-language "weather credit report": current conditions, a dynamic personality verdict, key metrics, and the raw payload for anyone who wants to check the numbers.

**Live app:** [https://sky-cred-rho.vercel.app](https://sky-cred-rho.vercel.app)

## What it does

- Loads Mumbai, India on first visit.
- Searches any city by name with the search button or Enter.
- Offers ten popular-city shortcuts: Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, New York, and London.
- Shows temperature, feels-like, condition text and icon, humidity, wind, UV, cloud cover, visibility, pressure, Fahrenheit, local time, timezone, and last-updated time.
- Derives a weather personality from the live numbers and condition:
  `storm > snow > rain > freeze (≤10°C) > sun (≥35°C) > wind (≥30 km/h) > perfect (18–30°C, humidity ≤85%) > warm > cool > mixed`.
- Shows a formatted or raw JSON view with copy-to-clipboard.
- Handles loading, invalid cities, missing configuration, rate limits, network failures, timeouts, and unexpected responses with retry where useful.
- Ignores outdated responses so a slow earlier search can never overwrite a newer one.
- Adapts from wide desktop layouts down to 320px and includes keyboard and screen-reader support.

## Tech stack

- Semantic HTML, one external stylesheet, and modular vanilla JavaScript (ES modules).
- A Vercel serverless function (`api/weather.js`) proxies WeatherAPI so the API key never reaches the browser.
- No framework, no build step, no client-side weather mocks.

## Project structure

```text
.
├── api/
│   └── weather.js        # Server-side WeatherAPI proxy
├── assets/
│   └── favicon.svg
├── js/
│   ├── app.js            # Search orchestration, abort/stale-request handling
│   ├── cities.js         # Popular cities and country qualification
│   ├── errors.js         # Error classification and user-facing messages
│   ├── formatters.js     # Number, time, and label formatting
│   ├── personality.js    # Weather personality rules and card themes
│   ├── ui.js             # Rendering, JSON tabs/copy, loading and error states
│   └── weather-api.js    # Proxy request and response validation
├── index.html
├── styles.css
├── vercel.json           # Routing, caching, and security headers
├── .env.example
└── package.json
```

## Local setup

Requirements: Node.js 18+ and a free [WeatherAPI](https://www.weatherapi.com/) key.

1. Install the Vercel CLI (or use `npx`):

   ```bash
   npm install -g vercel
   ```

2. Create `.env` in the project root:

   ```bash
   WEATHER_API_KEY=your_weatherapi_key_here
   ```

   `.env` is ignored by Git. Only `.env.example` is committed.

3. Start the local dev server, which runs the static site and the serverless proxy:

   ```bash
   vercel dev
   ```

4. Open the URL printed by the CLI (usually `http://localhost:3000`).

> Opening `index.html` directly with a file:// URL will not work because the app needs `/api/weather`. Use `vercel dev`.

## Deployment

1. Push this repository to GitHub.
2. Import the repository in Vercel, or run `vercel` from the project root.
3. Add `WEATHER_API_KEY` under **Project → Settings → Environment Variables** for Production, Preview, and Development.
4. Deploy. `vercel.json` supplies the security headers, CSP, no-store API caching, and function duration.

The frontend calls only the same-origin `/api/weather?q=...` endpoint. The WeatherAPI key stays in the serverless function's environment.

## Requirement-wise checklist

### Functional requirements

| # | Requirement | Implementation | Local test status |
|---|---|---|---|
| FR-01 | Load Mumbai by default, with loading feedback | `js/cities.js` default city; `js/app.js` initial load; skeleton/loading state in `js/ui.js` | Passed: default input, Mumbai data, loading indicator, populated card |
| FR-02 | Search by city name, button and Enter, validation | Search form in `index.html`; submit handling in `js/app.js`; empty-input validation | Passed: Enter, button, London/New York, empty input (no request), retained input |
| FR-03 | Ten popular-city shortcuts update all data without refresh | `POPULAR_CITIES` in `js/cities.js`; chip rendering and active state in `js/ui.js` | Passed: all 10 rendered, chip fetch, input sync, single active chip, error reverts active chip |
| FR-04 | Live current weather from WeatherAPI `/v1/current.json` | `js/weather-api.js` → `/api/weather` → WeatherAPI; rendering in `js/ui.js` | Passed: city/country, temp °C, condition, icon, feels-like, humidity, wind km/h, UV, local timezone, local clock, last updated |
| FR-05 | Dynamic weather personality | `js/personality.js` rule priority and copy | Passed: all thresholds and priority combinations, plus live Mumbai/Delhi/London/Bengaluru updates |
| FR-06 | Humidity, wind, UV cards plus secondary metrics | Metric cards and detail grid in `index.html`/`styles.css`; values from API | Passed: every displayed value matched the API payload, including cloud, visibility, pressure, °F, wind detail |
| FR-07 | Formatted and raw JSON viewer with copy | `js/ui.js` tab handling, highlighting, clipboard fallback | Passed: formatted indentation, raw equals network body, tab keyboard controls, copy in both views, independent scrolling |
| FR-08 | Loading, error, retry, and stale-response handling | `js/app.js` AbortController + request sequence; `js/errors.js` mapping; error banner and retry in `js/ui.js` | Passed: initial/refresh loading, invalid city, empty input, 401 config, 429 rate limit, 503 service, network failure, invalid JSON, retry success, slow-response stale protection |
| FR-09 | Responsive mobile layout | Fluid grids, breakpoints, and stacked controls in `styles.css` | Passed at 1440, 1024, 768, 390, and 320px: no page-level overflow, correct stacking, 3→1 metric columns |
| FR-10 | Accessibility | Labels, landmarks, `aria-live`, focus styles, keyboard tabs, `aria-pressed` chips, alt text | Passed DOM checks; Lighthouse Accessibility 100 |
| FR-11 | API key stays server-side | `.env` + `api/weather.js`; frontend calls same-origin proxy only | Passed locally: no key in frontend files or browser requests |
| FR-12 | No mocks or hardcoded weather values | Every displayed weather value comes from the live API response | Passed: all rendered values compared against API payload |
| FR-13 | HTML, separate CSS, modular vanilla JS | `index.html`, `styles.css`, ES modules in `js/` | Passed: no framework or build step |

### Testing summary

- **121 automated Playwright checks passed locally** (98 functional/responsive/accessibility, 23 async/state/priority).
- **35 automated production checks passed** against the live Vercel URL, including default load, Enter search, chip search, country disambiguation, raw/formatted JSON copy, invalid-city handling, responsive widths down to 320px, and API-key leakage checks.
- **Lighthouse (local):** Accessibility 100, Best Practices 100, SEO 100, no failing audits.
- **Lighthouse (live Vercel URL):** Accessibility 100, Best Practices 100, SEO 100, no failing audits.
- **Visual checks:** full-page screenshots at 1440px, 768px, and 390px, plus a focused weather-card review and a fresh-load mobile pass.
- **API checks:** live WeatherAPI responses verified for Mumbai, Delhi (country-qualified to India), Bengaluru, and London.
- **Security checks:** CSP, HSTS, frame denial, nosniff, referrer policy, and permissions policy confirmed on the live response; the WeatherAPI key was absent from the DOM and all browser requests.

### Honest gaps and caveats

- **Git-connected auto-deploy:** the Vercel account has no GitHub login connection, so the project was created and deployed through the Vercel API with a direct file upload. The GitHub repository is the source of truth, but a new push does not automatically trigger a Vercel build. Run `vercel --prod` from the project root (after `vercel link`) or repeat the API deployment to publish future changes. Linking the repo in the Vercel dashboard would enable automatic deploys.
- **Screenshot reference:** no design screenshot was attached to the brief, so the visual direction was interpreted from the written description. It may not match an unseen reference pixel-for-pixel.
- **Browser coverage:** automated checks ran in Chromium/Chrome only. Firefox and Safari were not tested.
- **Screen readers:** semantics and Lighthouse checks pass, but no manual NVDA/JAWS/VoiceOver session was performed.
- **Rare weather conditions:** snow, storm, and extreme-cold personalities were verified with controlled logic inputs, not by waiting for those conditions to occur in a live city. The app itself contains no mocked weather.
- **Local proxy:** local tests used a small Python server implementing the same `/api/weather` contract. The real Vercel function is verified separately after deployment.
- **Clipboard:** copy was tested with granted clipboard permissions in Chromium; the code includes a `document.execCommand` fallback for browsers that block the Clipboard API.

## Security notes

- `WEATHER_API_KEY` is read only in `api/weather.js` from the server environment.
- The API response is passed through with `Cache-Control: no-store`.
- `vercel.json` sets CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and a restrictive permissions policy.
- City input is trimmed, length-limited, and URL-encoded before being sent upstream.
- `.env` and `.vercel` are excluded from Git.
