const SUPABASE_URL = "https://ppxvqtntzncsyttfegdd.supabase.co";
const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";
const CENSUS_ENDPOINT =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

function cleanPlaceName(name) {
  return String(name || "")
    .replace(/\s+CDP$/i, "")
    .trim();
}

function municipalityFromGeographies(geographies) {
  const incorporated = geographies?.["Incorporated Places"]?.[0]?.NAME;
  if (incorporated) return cleanPlaceName(incorporated);

  const cdp = geographies?.["Census Designated Places"]?.[0]?.NAME;
  if (cdp) return cleanPlaceName(cdp);

  const subdivision = geographies?.["County Subdivisions"]?.[0]?.NAME;
  if (subdivision && /(township|town|borough|village)$/i.test(subdivision)) {
    return String(subdivision).trim();
  }

  return null;
}

async function lookupMunicipality(park) {
  const params = new URLSearchParams({
    x: String(park.longitude),
    y: String(park.latitude),
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json"
  });

  const response = await fetch(`${CENSUS_ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": "City-Park-Waves/1.0"
    }
  });

  if (!response.ok) return null;

  const data = await response.json();
  const geographies = data?.result?.geographies || {};
  const city = municipalityFromGeographies(geographies);
  const county = geographies?.Counties?.[0]?.NAME || null;

  if (!city) return null;

  return {
    id: park.id,
    city,
    county,
    note: "Municipality inferred from U.S. Census coordinate lookup."
  };
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      try {
        results.push(await fn(current));
      } catch (error) {
        console.error("Municipality lookup failed:", current?.id, error);
        results.push(null);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required." });
  }

  const authHeader = String(req.headers.authorization || "");

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Sign in required." });
  }

  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: authHeader
      }
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: "Your session is not valid." });
    }

    const user = await userResponse.json();

    const adminResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/operators?auth_user_id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: authHeader
        }
      }
    );

    const adminRows = adminResponse.ok ? await adminResponse.json() : [];

    if (!adminRows[0]?.is_admin) {
      return res.status(403).json({ error: "Admin access required." });
    }

    const parksResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/parks?select=id,name,city,state,latitude,longitude&needs_review=eq.true&latitude=not.is.null&longitude=not.is.null&order=id.asc&limit=40`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: authHeader
        }
      }
    );

    if (!parksResponse.ok) {
      const details = await parksResponse.text();
      return res.status(502).json({
        error: "Could not load parks needing municipality repair.",
        details: details.slice(0, 500)
      });
    }

    const parks = await parksResponse.json();

    if (!parks.length) {
      return res.status(200).json({
        processed: 0,
        repaired: 0,
        remaining: 0,
        complete: true
      });
    }

    const lookups = await mapWithConcurrency(parks, 8, lookupMunicipality);
    const repairs = lookups.filter(Boolean);

    let updated = 0;

    if (repairs.length) {
      const rpcResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/admin_apply_municipality_repairs`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: authHeader,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ payload: repairs })
        }
      );

      const rpcText = await rpcResponse.text();

      if (!rpcResponse.ok) {
        return res.status(502).json({
          error: "Could not save municipality repairs.",
          details: rpcText.slice(0, 500)
        });
      }

      try {
        updated = Number(JSON.parse(rpcText)?.updated || 0);
      } catch {}
    }

    const countResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/parks?select=id&needs_review=eq.true&city=eq.Unknown`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: authHeader,
          Prefer: "count=exact"
        }
      }
    );

    const contentRange = countResponse.headers.get("content-range") || "";
    const totalPart = contentRange.split("/")[1];
    const remaining = totalPart && totalPart !== "*" ? Number(totalPart) : null;

    return res.status(200).json({
      processed: parks.length,
      repaired: updated,
      remaining,
      complete: parks.length === 0
    });

  } catch (error) {
    console.error("Municipality repair failed:", error);

    return res.status(500).json({
      error: "Municipality cleanup failed.",
      details: String(error?.message || error)
    });
  }
}
