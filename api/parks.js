export default async function handler(req, res) {
  const SUPABASE_URL = "https://ppxvqtnzncsyttfegdd.supabase.co";
  const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";

  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.status(400).json({ error: "Missing search term." });
  }

  const filter = [
    `name.ilike.*${q}*`,
    `city.ilike.*${q}*`,
    `state.ilike.*${q}*`,
    `zip_code.ilike.*${q}*`
  ].join(",");

  const url =
    `${SUPABASE_URL}/rest/v1/parks` +
    `?select=id,name,city,state,zip_code,park_type,notes,is_active` +
    `&is_active=eq.true` +
    `&or=(${encodeURIComponent(filter)})` +
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
        status: response.status
      });
    }

    const parks = JSON.parse(text);
    return res.status(200).json(parks);
  } catch (error) {
    console.error("Park search failed:", error);
    return res.status(500).json({ error: "Unable to connect to the park database." });
  }
}
