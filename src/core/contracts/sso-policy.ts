const LOCAL_ORIGIN = /^http:\/\/localhost(?::\d+)?$/i;

export function normalizeSsoOrigin(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_ORIGIN.test(url.origin))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getConfiguredSsoOrigins(value: string | undefined): string[] {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((item) => normalizeSsoOrigin(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

export function isAllowedSsoOrigin(value: unknown, allowlist: readonly string[]): value is string {
  const normalized = normalizeSsoOrigin(value);
  return Boolean(normalized && allowlist.includes(normalized));
}

export function normalizeLawHubReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.trim() !== value) return null;
  if (value !== decodeURIComponentSafe(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  if (value.includes("/../") || value.endsWith("/..") || value.includes("/./")) return null;
  try {
    const url = new URL(value, "https://internal.navor.invalid");
    if (url.origin !== "https://internal.navor.invalid") return null;
    if (url.search || url.hash) return null;
    const isLawHub = url.pathname === "/lawhub" || url.pathname.startsWith("/lawhub/");
    if (!isLawHub) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "__invalid__";
  }
}
