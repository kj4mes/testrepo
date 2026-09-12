export default async function handler(req, res) {
  const SUPABASE_URL = "https://ppxvqtnzncsyttfegdd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";

  const q = String(req.query.q || "").trim().toLowerCase();

  if (!q) {
    return res.status(400).json({ error: "Missing search term." });
  }

  // Keep the Supabase request simple and do the text matching here.
  // This avoids PostgREST OR-filter parsing issues while we prove the connection works.
  const url =
    `${SUPABASE_URL}/rest/v1/parks` +
    `?select=id,name,city,state,zip_code,park_type,notes,is_active` +
    `&is_active=eq.true` +
    `&order=name.asc`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("Supabase error:", response.status, text);
      return res.status(502).json({
        error: "Supabase request failed.",
        supabase_status: response.status,
        details: text.slice(0, 500)
      });
    }

    const parks = JSON.parse(text);

    const matches = parks.filter((park) => {
      const haystack = [
        park.name,
        park.city,
        park.state,
        park.zip_code
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    return res.status(200).json(matches);
  } catch (error) {
    console.error("Park search failed:", error);
    return res.status(500).json({
      error: "Unable to connect to the park database.",
      details: String(error?.message || error)
    });
  }
}
