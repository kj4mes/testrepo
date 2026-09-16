export default async function handler(req, res) {
  const callsign = String(req.query.callsign || "")
    .trim()
    .toUpperCase();

  if (!callsign) {
    return res.status(400).json({ error: "Missing callsign." });
  }

  if (!/^[A-Z0-9]{3,6}$/.test(callsign)) {
    return res.status(400).json({
      error: "Enter a valid amateur radio callsign."
    });
  }

  // HamDB provides current amateur-radio license data and links records
  // back to the FCC ULS. We use its JSON endpoint here because the
  // older FCC License View API endpoint is currently unreliable.
  const endpoint =
    "https://api.hamdb.org/" +
    encodeURIComponent(callsign) +
    "/json/cityparkwaves";

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "City-Park-Waves/1.0"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: "Callsign lookup failed.",
        lookup_status: response.status,
        details: text.slice(0, 300)
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Callsign service returned an unexpected response."
      });
    }

    const record = data?.hamdb?.callsign;

    if (!record || !record.call) {
      return res.status(200).json({
        callsign,
        found: false,
        active: false,
        verified: false,
        status: "Not Found"
      });
    }

    const returnedCallsign = String(record.call).trim().toUpperCase();

    if (returnedCallsign !== callsign) {
      return res.status(200).json({
        callsign,
        found: false,
        active: false,
        verified: false,
        status: "Not Found"
      });
    }

    const rawStatus = String(record.status || "").trim().toUpperCase();
    // HamDB mirrors FCC status codes. "A" means Active; some responses or
    // future providers may return the full word instead, so support both.
    const active = rawStatus === "A" || rawStatus === "ACTIVE";
    const status = active
      ? "Active"
      : (rawStatus === "E" ? "Expired" : (rawStatus || "Unknown"));

    return res.status(200).json({
      callsign,
      found: true,
      amateur: true,
      active,
      verified: active,
      status,
      service: record.class || null,
      expiration: record.expires || null,
      licensee_name: [record.fname, record.mi, record.name, record.suffix]
        .filter(Boolean)
        .join(" ")
        .trim() || null,
      city: record.addr2 || null,
      grid: record.grid || null,
      state: record.state || null,
      country: record.country || null,
      source: "HamDB / FCC ULS"
    });

  } catch (error) {
    console.error("Callsign lookup failed:", error);

    return res.status(500).json({
      error: "Unable to reach the callsign verification service.",
      details: String(error?.message || error)
    });
  }
}
