const SUPABASE_URL = "https://ppxvqtntzncsyttfegdd.supabase.co";
const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";

export default async function handler(req, res) {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);

  if (!q) {
    return res.status(400).json({ error: "Missing search term." });
  }

  try {
    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/cpw_search_parks",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_query: q,
          p_limit: limit
        })
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("Supabase search error:", response.status, text);

      return res.status(502).json({
        error: "Park search failed.",
        details: text.slice(0, 500)
      });
    }

    const parks = JSON.parse(text);

    return res.status(200).json(Array.isArray(parks) ? parks : []);
  } catch (error) {
    console.error("Park search failed:", error);

    return res.status(500).json({
      error: "Unable to connect to the park database."
    });
  }
}
