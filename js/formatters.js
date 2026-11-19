const numberFormatters = new Map();

function getNumberFormatter(digits) {
  if (!numberFormatters.has(digits)) {
    numberFormatters.set(
      digits,
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      })
    );
  }

  return numberFormatters.get(digits);
}

export function formatDecimal(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return getNumberFormatter(digits).format(number);
}

export function formatInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return Math.round(number).toLocaleString("en-US");
}

function createDate(epochSeconds) {
  const number = Number(epochSeconds);
  if (!Number.isFinite(number)) return null;
  return new Date(number * 1000);
}

function formatWithTimeZone(date, timeZone, options, fallback) {
  if (!date || !timeZone) return fallback;

  try {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone
    }).format(date);
  } catch {
    return fallback;
  }
}

export function formatTime(epochSeconds, timeZone, fallback = "—") {
  return formatWithTimeZone(
    createDate(epochSeconds),
    timeZone,
    { hour: "numeric", minute: "2-digit", hour12: true },
    fallback
  );
}

export function formatDate(epochSeconds, timeZone, fallback = "—") {
  return formatWithTimeZone(
    createDate(epochSeconds),
    timeZone,
    { weekday: "short", day: "numeric", month: "short" },
    fallback
  );
}

export function formatLongDate(epochSeconds, timeZone, fallback = "—") {
  return formatWithTimeZone(
    createDate(epochSeconds),
    timeZone,
    { day: "numeric", month: "short", year: "numeric" },
    fallback
  );
}

export function formatTimeZoneName(epochSeconds, timeZone, fallback = "—") {
  const date = createDate(epochSeconds) ?? new Date();

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short"
    }).formatToParts(date);

    return parts.find((part) => part.type === "timeZoneName")?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export function formatReportNumber(epochSeconds, timeZone) {
  const date = createDate(epochSeconds);
  if (!date) return "No. —";

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const month = parts.find((part) => part.type === "month")?.value ?? "—";
    const day = parts.find((part) => part.type === "day")?.value ?? "—";
    return `No. ${month}·${day}`;
  } catch {
    return "No. —";
  }
}

export function formatRelativeTime(epochSeconds) {
  const epoch = Number(epochSeconds);
  if (!Number.isFinite(epoch)) return "—";

  const seconds = Math.floor(Date.now() / 1000 - epoch);
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size)) return "—";
  if (size < 1024) return `${size} B`;
  return `${formatDecimal(size / 1024, 1)} KB`;
}

export function getByteSize(text) {
  return new TextEncoder().encode(String(text ?? "")).length;
}
