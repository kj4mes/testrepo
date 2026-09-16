const SUPABASE_URL = "https://ppxvqtntzncsyttfegdd.supabase.co";
const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";

export default async function handler(req, res) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ error: "Sign in is required." });
  }

  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY
      }
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: "Your sign-in session is not valid." });
    }

    const callsign = String(req.query.callsign || "").trim().toUpperCase();

    if (!/^[A-Z0-9]{3,6}$/.test(callsign)) {
      return res.status(400).json({ error: "Enter a valid amateur radio callsign." });
    }

    const endpoint =
      "https://api.hamdb.org/" +
      encodeURIComponent(callsign) +
      "/json/cityparkwaves";

    const response = await fetch(endpoint, {
      headers: { "User-Agent": "City-Park-Waves/1.0" }
    });

    if (!response.ok) {
      return res.status(502).json({ error: "FCC callsign lookup failed." });
    }

    const data = await response.json();
    const record = data?.hamdb?.callsign;

    if (!record || String(record.call || "").trim().toUpperCase() !== callsign) {
      return res.status(404).json({ error: "Callsign not found." });
    }

    const rawStatus = String(record.status || "").trim().toUpperCase();
    const active = rawStatus === "A" || rawStatus === "ACTIVE";

    if (!active) {
      return res.status(400).json({ error: "The callsign is not currently active." });
    }

    return res.status(200).json({
      callsign,
      status: "Active",
      license_class: record.class || null,
      expiration: record.expires || null,
      licensee_name: [record.fname, record.mi, record.name, record.suffix]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
      street_address: record.addr1 || null,
      city: record.addr2 || null,
      state: record.state || null,
      zip: record.zip || null,
      country: record.country || null,
      grid: record.grid || null,
      source: "HamDB / FCC ULS"
    });
  } catch (error) {
    console.error("Authenticated FCC profile lookup failed:", error);
    return res.status(500).json({ error: "Unable to retrieve the FCC record." });
  }
}
