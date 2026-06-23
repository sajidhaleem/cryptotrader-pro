/**
 * Binance proxy worker — called directly from the user's browser.
 * Runs at the Cloudflare edge nearest to the user (e.g. Pakistan),
 * bypassing US-based hosting geo-blocks on Binance.
 *
 * Security: CORS is restricted to the production domain.
 * URL allowlist prevents misuse beyond Binance API endpoints.
 */

const ALLOWED_ORIGINS = [
  "https://api.binance.com/",
  "https://testnet.binance.vision/",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://cryptotrader-pro.netlify.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
    }

    const { url, apiKey } = body;

    if (!url || !apiKey) {
      return new Response("Missing url or apiKey", { status: 400, headers: CORS_HEADERS });
    }

    // Only allow Binance URLs
    if (!ALLOWED_ORIGINS.some((origin) => url.startsWith(origin))) {
      return new Response("Forbidden: URL not in allowlist", { status: 403, headers: CORS_HEADERS });
    }

    const response = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  },
};
