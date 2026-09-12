export default async function handler(req, res) {
  const callsign = String(req.query.callsign || "")
    .trim()
    .toUpperCase();

  if (!callsign) {
    return res.status(400).json({ error: "Missing callsign." });
  }

  if (!/^[A-Z0-9]{3,6}$/.test(callsign)) {
    return res.status(400).json({
      error: "Enter a valid U.S. amateur radio callsign."
    });
  }

  const endpoint =
    "https://data.fcc.gov/api/license-view/basicSearch/getLicenses" +
    "?searchValue=" + encodeURIComponent(callsign) +
    "&format=json";

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "City-Park-Waves/1.0"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: "FCC lookup failed.",
        fcc_status: response.status,
        details: text.slice(0, 300)
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "FCC returned an unexpected response."
      });
    }

    const licenses = data?.Licenses?.License;

    const list = Array.isArray(licenses)
      ? licenses
      : licenses
      ? [licenses]
      : [];

    const exact = list.find((license) => {
      const returnedCallsign = String(
        license.callsign ||
        license.callSign ||
        ""
      ).trim().toUpperCase();

      return returnedCallsign === callsign;
    });

    if (!exact) {
      return res.status(200).json({
        callsign,
        found: false,
        active: false,
        verified: false,
        status: "Not Found"
      });
    }

    const statusDesc = String(
      exact.statusDesc ||
      exact.status ||
      ""
    ).trim();

    const serviceDesc = String(
      exact.serviceDesc ||
      exact.service ||
      ""
    ).trim();

    const serviceCode = String(
      exact.serviceCode ||
      exact.radioServiceCode ||
      ""
    ).trim().toUpperCase();

    const isAmateur =
      /amateur/i.test(serviceDesc) ||
      ["HA", "HV"].includes(serviceCode);

    const isActive =
      /^active$/i.test(statusDesc) ||
      String(exact.status || "").trim().toUpperCase() === "A";

    const expiration =
      exact.expiredDate ||
      exact.expirationDate ||
      exact.expDate ||
      null;

    return res.status(200).json({
      callsign,
      found: true,
      amateur: isAmateur,
      active: isAmateur && isActive,
      verified: isAmateur && isActive,
      status: statusDesc || (isActive ? "Active" : "Unknown"),
      service: serviceDesc || serviceCode || null,
      expiration,
      licensee_name:
        exact.licName ||
        exact.licenseeName ||
        null,
      fcc_license_id:
        exact.licenseID ||
        exact.uniqueSystemIdentifier ||
        null,
      source: "FCC ULS License View"
    });

  } catch (error) {
    console.error("FCC callsign lookup failed:", error);

    return res.status(500).json({
      error: "Unable to reach the FCC callsign database.",
      details: String(error?.message || error)
    });
  }
}
