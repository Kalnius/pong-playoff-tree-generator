const DEFAULT_STORAGE_KEY = "playoff-form-state-v2";

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCodePoint(byte);
  });

  const base64 = window.btoa(binary).replaceAll("+", "-").replaceAll("/", "_");
  return base64.endsWith("==")
    ? base64.slice(0, -2)
    : base64.endsWith("=")
      ? base64.slice(0, -1)
      : base64;
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) || 0);
  return new TextDecoder().decode(bytes);
}

function getSearchParams(url) {
  if (url) {
    try {
      return new URL(url, window.location.href).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }
  return new URLSearchParams(window.location.search);
}

function getHashParams(url) {
  let hash = "";
  if (url) {
    try {
      const parsed = new URL(url, window.location.href);
      hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    } catch {
      hash = "";
    }
  } else {
    hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
  }
  return new URLSearchParams(hash);
}

export function buildStateUrl(data, baseUrl) {
  try {
    const nextUrl = new URL(baseUrl || window.location.href);
    nextUrl.searchParams.delete("state");
    const hashParams = getHashParams(baseUrl);
    if (data !== undefined && data !== null) {
      hashParams.set("state", encodeBase64Url(JSON.stringify(data)));
    } else {
      hashParams.delete("state");
    }
    nextUrl.hash = hashParams.toString();
    return nextUrl.toString();
  } catch {
    return "";
  }
}

export function getData(options = {}) {
  const { storageKey, url } = options;
  const hashParams = getHashParams(url);
  const searchParams = getSearchParams(url);
  const key =
    storageKey || searchParams.get("storageKey") || DEFAULT_STORAGE_KEY;

  const encoded = hashParams.get("state") || searchParams.get("state");
  if (encoded) {
    try {
      return JSON.parse(decodeBase64Url(encoded));
    } catch {
      // fallback to localStorage
    }
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore storage access errors
  }

  return null;
}

export function saveData(data, options = {}) {
  const { storageKey } = options;
  const searchParams = getSearchParams();
  const key =
    storageKey || searchParams.get("storageKey") || DEFAULT_STORAGE_KEY;
  let savedLocally = false;

  try {
    window.localStorage.setItem(key, JSON.stringify(data));
    savedLocally = true;
  } catch {
    savedLocally = false;
  }

  try {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("state");
    const hashParams = getHashParams();
    if (data !== undefined && data !== null) {
      hashParams.set("state", encodeBase64Url(JSON.stringify(data)));
    } else {
      hashParams.delete("state");
    }
    nextUrl.hash = hashParams.toString();
    window.history.replaceState(null, "", nextUrl);
  } catch {
    // ignore history sync errors
  }

  return savedLocally;
}
