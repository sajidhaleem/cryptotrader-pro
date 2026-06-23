/**
 * Binance proxy worker — routes pre-signed Binance requests through
 * Cloudflare's global edge so they don't originate from US-based servers.
 *
 * Deploy free at: https://workers.cloudflare.com
 * Set env var PROXY_SECRET in the Worker dashboard.
 */

const ALLOWED_ORIGINS = [
  "https://api.binance.com/",
  "https://testnet.binance.vision/",
];

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Validate shared secret
    if (request.headers.get("X-Proxy-Secret") !== env.PROXY_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { url, apiKey } = body;

    if (!url || !apiKey) {
      return new Response("Missing url or apiKey", { status: 400 });
    }

    // Only allow Binance URLs
    if (!ALLOWED_ORIGINS.some((origin) => url.startsWith(origin))) {
      return new Response("Forbidden: URL not in allowlist", { status: 403 });
    }

    const response = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};
