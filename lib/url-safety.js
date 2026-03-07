import { lookup } from "node:dns/promises";
import net from "node:net";

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 5;
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "metadata.google.internal",
]);
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
];

export class PublicUrlValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublicUrlValidationError";
  }
}

export function isPublicUrlValidationError(error) {
  return error instanceof PublicUrlValidationError;
}

export async function assertSafePublicUrl(input) {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) {
    throw new PublicUrlValidationError("진단할 공개 URL이 필요합니다.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new PublicUrlValidationError("URL 형식이 올바르지 않습니다.");
  }

  if (!SAFE_PROTOCOLS.has(url.protocol)) {
    throw new PublicUrlValidationError("http 또는 https URL만 진단할 수 있습니다.");
  }

  if (!url.hostname) {
    throw new PublicUrlValidationError("호스트가 없는 URL은 진단할 수 없습니다.");
  }

  if (url.username || url.password) {
    throw new PublicUrlValidationError("인증 정보가 포함된 URL은 허용되지 않습니다.");
  }

  url.hash = "";
  await assertPublicHostname(url.hostname);
  return url.toString();
}

export async function fetchWithSafeRedirects(url, init = {}, options = {}) {
  const requestInit = { ...init };
  delete requestInit.redirect;

  let currentUrl = options.skipInitialValidation ? String(url) : await assertSafePublicUrl(url);

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const response = await fetch(currentUrl, {
      ...requestInit,
      redirect: "manual",
    });

    if (!isRedirect(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    currentUrl = await assertSafePublicUrl(new URL(location, currentUrl).toString());
  }

  throw new Error("리다이렉트가 너무 많습니다.");
}

function isRedirect(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function assertPublicHostname(hostname) {
  const normalized = hostname.toLowerCase();

  if (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  ) {
    throw new PublicUrlValidationError("내부 네트워크 주소는 진단할 수 없습니다.");
  }

  if (net.isIP(normalized)) {
    assertPublicIp(normalized);
    return;
  }

  let addresses;
  try {
    addresses = await lookup(normalized, { all: true, verbatim: true });
  } catch {
    throw new PublicUrlValidationError("공개 DNS에서 확인 가능한 URL만 진단할 수 있습니다.");
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new PublicUrlValidationError("공개 DNS에서 확인 가능한 URL만 진단할 수 있습니다.");
  }

  for (const record of addresses) {
    assertPublicIp(record?.address || "");
  }
}

function assertPublicIp(address) {
  if (!address) {
    throw new PublicUrlValidationError("IP 주소를 확인할 수 없습니다.");
  }

  const mappedIpv4 = extractMappedIpv4(address);
  if (mappedIpv4) {
    assertPublicIp(mappedIpv4);
    return;
  }

  if (net.isIPv4(address)) {
    if (isPrivateIpv4(address)) {
      throw new PublicUrlValidationError("사설 또는 예약 네트워크 주소는 진단할 수 없습니다.");
    }
    return;
  }

  if (net.isIPv6(address)) {
    if (isPrivateIpv6(address)) {
      throw new PublicUrlValidationError("사설 또는 예약 네트워크 주소는 진단할 수 없습니다.");
    }
    return;
  }

  throw new PublicUrlValidationError("유효한 공개 IP 주소만 진단할 수 있습니다.");
}

function extractMappedIpv4(address) {
  const normalized = String(address || "").toLowerCase();
  if (!normalized.startsWith("::ffff:")) return "";

  const candidate = normalized.slice(7);
  return net.isIPv4(candidate) ? candidate : "";
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map((value) => Number.parseInt(value, 10));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return true;
  }

  const [a, b, c] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c <= 2) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;

  return false;
}

function isPrivateIpv6(address) {
  const normalized = String(address || "").toLowerCase();

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("2001:db8")) return true;

  return false;
}
