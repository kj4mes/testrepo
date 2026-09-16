export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const header = (name) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const latitude = Number(header("x-vercel-ip-latitude"));
  const longitude = Number(header("x-vercel-ip-longitude"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(204).end();
  }

  return res.status(200).json({
    latitude,
    longitude,
    city: header("x-vercel-ip-city") || null,
    region: header("x-vercel-ip-country-region") || null,
    postal_code: header("x-vercel-ip-postal-code") || null,
    country: header("x-vercel-ip-country") || null,
    source: "vercel-ip-geolocation",
    approximate: true
  });
}
