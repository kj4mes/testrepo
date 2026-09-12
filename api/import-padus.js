const SUPABASE_URL = "https://ppxvqtntzncsyttfegdd.supabase.co";
const SUPABASE_KEY = "sb_publishable_pOQ38QcleCUtLHeGWdb0RQ_nqvgkaxo";

const PADUS_QUERY =
  "https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/" +
  "Fee_Managers_PADUS/FeatureServer/0/query";

function deriveCity(attributes) {
  const raw =
    attributes.Loc_Mang ||
    attributes.Loc_Own ||
    "";

  return String(raw)
    .replace(/^(city|town|village|borough|municipality)\s+of\s+/i, "")
    .replace(/\s+(parks?(\s+and\s+recreation)?|park\s+department).*$/i, "")
    .trim() || "Unknown";
}

function parkName(attributes) {
  return String(
    attributes.Loc_Nm ||
    attributes.Unit_Nm ||
    ""
  ).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required." });
  }

  const authHeader = String(req.headers.authorization || "");

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Sign in required." });
  }

  const state = String(req.body?.state || "").trim().toUpperCase();
  const offset = Math.max(0, Number(req.body?.offset || 0));

  if (!/^[A-Z]{2}$/.test(state)) {
    return res.status(400).json({ error: "A 2-letter state code is required." });
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
      `${SUPABASE_URL}/rest/v1/operators?auth_user_id=eq.${encodeURIComponent(user.id)}&select=is_admin,callsign`,
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

    const where =
      `State_Nm='${state}' AND ` +
      `(Mang_Name='CITY' OR Own_Name='CITY') AND ` +
      `(Pub_Access='OA' OR Pub_Access='UK') AND ` +
      `(Unit_Nm LIKE '%Park%' OR Loc_Nm LIKE '%Park%')`;

    const params = new URLSearchParams({
      where,
      outFields: [
        "OBJECTID",
        "Unit_Nm",
        "Loc_Nm",
        "State_Nm",
        "Loc_Mang",
        "Loc_Own",
        "Des_Tp",
        "Loc_Ds",
        "Pub_Access",
        "Agg_Src",
        "GIS_Src",
        "Source_PAID"
      ].join(","),
      returnGeometry: "false",
      resultOffset: String(offset),
      resultRecordCount: "500",
      orderByFields: "OBJECTID ASC",
      f: "json"
    });

    const padusResponse = await fetch(`${PADUS_QUERY}?${params.toString()}`, {
      headers: {
        "User-Agent": "City-Park-Waves/1.0"
      }
    });

    if (!padusResponse.ok) {
      return res.status(502).json({ error: "PAD-US request failed." });
    }

    const padusData = await padusResponse.json();

    if (padusData.error) {
      return res.status(502).json({
        error: "PAD-US returned an error.",
        details: padusData.error.message || "Unknown PAD-US error."
      });
    }

    const features = Array.isArray(padusData.features)
      ? padusData.features
      : [];

    const rows = features
      .map((feature) => {
        const a = feature.attributes || {};
        const name = parkName(a);

        if (!name) return null;

        return {
          name,
          city: deriveCity(a),
          state,
          park_type: "city park",
          notes: [
            a.Loc_Ds ? `PAD-US designation: ${a.Loc_Ds}` : null,
            a.Loc_Mang ? `Manager: ${a.Loc_Mang}` : null,
            a.Pub_Access === "OA" ? "Public access: open" : "Public access: unknown"
          ].filter(Boolean).join(". "),
          is_active: true,
          source_name: "USGS PAD-US 4.1",
          source_id: String(a.Source_PAID || a.OBJECTID),
          source_url:
            "https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Fee_Managers_PADUS/FeatureServer/0"
        };
      })
      .filter(Boolean);

    let imported = 0;

    if (rows.length) {
      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/parks?on_conflict=source_name,source_id`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: authHeader,
            "Content-Type": "application/json",
            Prefer: "resolution=ignore-duplicates,return=minimal"
          },
          body: JSON.stringify(rows)
        }
      );

      if (!insertResponse.ok) {
        const details = await insertResponse.text();

        return res.status(502).json({
          error: "Could not save imported parks.",
          details: details.slice(0, 500)
        });
      }

      imported = rows.length;
    }

    const hasMore =
      features.length === 500 ||
      Boolean(padusData.exceededTransferLimit);

    return res.status(200).json({
      state,
      fetched: features.length,
      imported,
      offset,
      next_offset: hasMore ? offset + features.length : null,
      complete: !hasMore
    });

  } catch (error) {
    console.error("PAD-US import failed:", error);

    return res.status(500).json({
      error: "Nationwide park import failed.",
      details: String(error?.message || error)
    });
  }
}
