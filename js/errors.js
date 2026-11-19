/**
 * Translate API/network failures into product language. Keep the phrases used
 * in the PRD intact so error acceptance criteria are explicit.
 */
export function getErrorPresentation(error, city) {
  const type = error?.type ?? "unexpected";
  const safeCity = String(city ?? "").trim();

  switch (type) {
    case "city":
      return {
        type,
        title: "City not found",
        message: safeCity
          ? `We couldn’t find “${safeCity}”. Check the spelling and try again.`
          : "We couldn’t find that city. Check the spelling and try again.",
        canRetry: true
      };
    case "configuration":
      return {
        type,
        title: "API configuration error",
        message: "The weather service key is missing or invalid. Check the WEATHER_API_KEY environment variable in Vercel.",
        canRetry: false
      };
    case "rateLimit":
      return {
        type,
        title: "Temporary service error",
        message: "WeatherAPI’s request limit has been reached. Please try again shortly.",
        canRetry: true
      };
    case "network":
      return {
        type,
        title: "No internet connection",
        message: "Check your network connection and retry when you’re back online.",
        canRetry: true
      };
    case "timeout":
      return {
        type,
        title: "Weather service timed out",
        message: "WeatherAPI took too long to respond. Please retry in a moment.",
        canRetry: true
      };
    case "service":
      return {
        type,
        title: "Weather service unavailable",
        message: "WeatherAPI is not responding right now. Please try again shortly.",
        canRetry: true
      };
    case "unexpected":
    default:
      return {
        type: "unexpected",
        title: "Something went wrong",
        message: "The weather service returned an unexpected response. Please retry.",
        canRetry: true
      };
  }
}
