function normalizeCallsign(value) {
  return String(value || "").trim().toUpperCase();
}

function validLookupCallsign(value) {
  return /^[A-Z0-9]{3,10}$/.test(value);
}

async function lookupHamDbGrid(callsign) {
  const endpoint =
    "https://api.hamdb.org/" +
    encodeURIComponent(callsign) +
    "/json/cityparkwaves";

  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "City-Park-Waves/1.0"
    }
  });

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  const record = data?.hamdb?.callsign;

  if (!record?.call) return null;

  const returnedCall = normalizeCallsign(record.call);
  if (returnedCall !== callsign) return null;

  const grid = String(record.grid || "").trim().toUpperCase();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(grid)) return null;

  return grid;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;

      try {
        results[index] = await worker(items[index]);
      } catch {
        results[index] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run())
  );

  return results;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const input = Array.isArray(req.body?.callsigns) ? req.body.callsigns : [];

  const callsigns = Array.from(
    new Set(
      input
        .map(normalizeCallsign)
        .filter(validLookupCallsign)
    )
  ).slice(0, 100);

  if (!callsigns.length) {
    return res.status(200).json({ grids: {} });
  }

  const lookedUp = await mapWithConcurrency(
    callsigns,
    5,
    async (callsign) => ({
      callsign,
      grid: await lookupHamDbGrid(callsign)
    })
  );

  const grids = {};

  for (const item of lookedUp) {
    if (item?.callsign && item?.grid) {
      grids[item.callsign] = item.grid;
    }
  }

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  return res.status(200).json({
    source: "HamDB",
    requested: callsigns.length,
    found: Object.keys(grids).length,
    grids
  });
}
