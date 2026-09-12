const SUPABASE_URL = "https://ppxvqtntzncsyttfegdd.supabase.co";
const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";

function distanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (value) => value * Math.PI / 180;
  const earthRadiusMiles = 3958.7613;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export default async function handler(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Valid latitude and longitude are required." });
  }

  try {
    const boxes = [0.25, 0.5, 1, 2];
    let parks = [];

    for (const span of boxes) {
      const minLat = lat - span;
      const maxLat = lat + span;
      const minLon = lon - span;
      const maxLon = lon + span;

      const url =
        SUPABASE_URL +
        "/rest/v1/parks" +
        "?select=id,reference_code,name,city,state,zip_code,park_type,latitude,longitude,source_name" +
        "&is_active=eq.true" +
        "&latitude=not.is.null" +
        "&longitude=not.is.null" +
        "&latitude=gte." + encodeURIComponent(minLat) +
        "&latitude=lte." + encodeURIComponent(maxLat) +
        "&longitude=gte." + encodeURIComponent(minLon) +
        "&longitude=lte." + encodeURIComponent(maxLon) +
        "&limit=500";

      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY
        }
      });

      if (!response.ok) {
        const details = await response.text();
        return res.status(502).json({
          error: "Unable to search nearby parks.",
          details: details.slice(0, 400)
        });
      }

      parks = await response.json();

      if (parks.length >= limit || span === boxes[boxes.length - 1]) {
        break;
      }
    }

    const results = parks
      .map((park) => ({
        ...park,
        distance_miles: distanceMiles(
          lat,
          lon,
          Number(park.latitude),
          Number(park.longitude)
        )
      }))
      .sort((a, b) => a.distance_miles - b.distance_miles)
      .slice(0, limit);

    return res.status(200).json(results);

  } catch (error) {
    console.error("Nearby park search failed:", error);

    return res.status(500).json({
      error: "Unable to search nearby parks."
    });
  }
}
