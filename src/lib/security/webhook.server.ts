function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function verifyWebhookChallenge(request: Request): boolean {
  const expected = process.env["WHATSAPP_VERIFY_TOKEN"];
  if (!expected) return false;
  const url = new URL(request.url);
  const provided = url.searchParams.get("hub.verify_token") || url.searchParams.get("verify_token") || "";
  return constantTimeEqual(provided, expected);
}

export async function verifyWebhookSignature(request: Request, rawBody: string): Promise<boolean> {
  const secret = process.env["WHATSAPP_WEBHOOK_SECRET"];
  if (!secret) return false;

  const directSecret = request.headers.get("x-webhook-secret");
  if (directSecret && constantTimeEqual(directSecret, secret)) return true;

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=") || typeof crypto === "undefined" || !crypto.subtle) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return constantTimeEqual(signature.slice(7).toLowerCase(), bytesToHex(new Uint8Array(digest)));
}
