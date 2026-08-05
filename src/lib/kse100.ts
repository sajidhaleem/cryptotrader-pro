// KSE-100 index data straight from PSX's own Data Portal System — Yahoo Finance
// does not carry this index at all (^KSE100 and every plausible variant 404s;
// confirmed via exhaustive search against Yahoo's own symbol-search API).
import axios from "axios";
import type { PricePoint, PsxQuote } from "./psx-price";

interface PsxTimeseriesResponse {
  status: number;
  data: [number, number, number, number?][]; // [unixSeconds, indexValue, volume, ...]
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

export async function fetchKse100(): Promise<PsxQuote> {
  const [{ data: eod }, { data: intraday }] = await Promise.all([
    axios.get<PsxTimeseriesResponse>("https://dps.psx.com.pk/timeseries/eod/KSE100", { headers: HEADERS, timeout: 12000 }),
    axios.get<PsxTimeseriesResponse>("https://dps.psx.com.pk/timeseries/int/KSE100", { headers: HEADERS, timeout: 12000 })
      .catch(() => ({ data: null as PsxTimeseriesResponse | null })),
  ]);

  if (eod.status !== 1 || !eod.data?.length) throw new Error("No KSE-100 data available");

  // PSX returns newest-first; the rest of the app expects oldest -> newest.
  const history: PricePoint[] = eod.data
    .slice(0, 90)
    .reverse()
    .map(([time, close]) => ({ time, close }));

  const lastClose = history[history.length - 1];
  const latestTick = intraday?.data?.[0];
  const price = latestTick ? latestTick[1] : lastClose.close;

  // Append today's live level when the market's still open and diverges from
  // yesterday's EOD close, so the chart reflects the current session.
  if (latestTick && latestTick[0] > lastClose.time) {
    history.push({ time: latestTick[0], close: price });
  }

  const change1d = lastClose.close > 0 ? ((price - lastClose.close) / lastClose.close) * 100 : 0;
  const closes = history.map((h) => h.close);

  return { closes, history, price, change1d };
}
