export default async function handler(req, res) {
  if (String(req.query.location_helper || "") === "1") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>City Park Waves Location Helper</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#eef7fb;color:#17324d}
main{max-width:680px;margin:0 auto;padding:36px 18px}
.card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(23,50,77,.12);text-align:center}
button{font-size:18px;font-weight:700;padding:14px 20px;border:0;border-radius:12px;background:#0f766e;color:#fff}
p{line-height:1.45}
</style>
</head>
<body>
<main><div class="card">
<h1>Finding Your Location</h1>
<p id="status">City Park Waves is using its alternate location helper.</p>
<button id="goButton" type="button">Continue</button>
</div></main>
<script>
const status=document.getElementById("status");
const button=document.getElementById("goButton");
function finish(lat,lon){
  const url=new URL("https://cityparkwaves.org/");
  url.searchParams.set("cpw_lat",String(lat));
  url.searchParams.set("cpw_lon",String(lon));
  url.searchParams.set("cpw_location_source","helper");
  url.hash="map";
  location.replace(url.toString());
}
function fail(){
  const url=new URL("https://cityparkwaves.org/");
  url.searchParams.set("cpw_location_error","1");
  url.hash="map";
  location.replace(url.toString());
}
function locate(){
  if(!navigator.geolocation){
    status.textContent="Location is not available in this browser.";
    button.disabled=true;
    return;
  }

  button.disabled=true;
  status.textContent="Requesting your current location…";

  navigator.geolocation.getCurrentPosition(
    p=>finish(p.coords.latitude,p.coords.longitude),
    e=>{
      console.error(e);
      status.textContent="Location was not granted here. Tap Try Again after allowing location for this Vercel page.";
      button.disabled=false;
      button.textContent="Try Again";
    },
    {enableHighAccuracy:true,timeout:20000,maximumAge:60000}
  );
}

button.textContent="Allow Location & Return";
status.textContent="Tap the button below to allow location on the alternate helper, then you will return to City Park Waves.";
button.addEventListener("click",locate);
</script>
</body>
</html>`);
  }

  if (String(req.query.location_test || "") === "1") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>City Park Waves Location Test</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#eef7fb;color:#17324d}
main{max-width:720px;margin:0 auto;padding:32px 18px}
.card{background:#fff;border-radius:16px;padding:22px;box-shadow:0 10px 30px rgba(23,50,77,.12)}
button{font-size:18px;font-weight:700;padding:14px 18px;border:0;border-radius:12px;background:#0f766e;color:#fff}
pre{white-space:pre-wrap;word-break:break-word;background:#f5f7f9;padding:14px;border-radius:10px;margin-top:18px}
</style>
</head>
<body>
<main><div class="card">
<h1>Location Test</h1>
<p>This page uses only the browser geolocation API.</p>
<button id="testButton" type="button">Test My Location</button>
<pre id="result">Tap the button to test.</pre>
</div></main>
<script>
const result=document.getElementById("result");
document.getElementById("testButton").addEventListener("click",()=>{
  const base={
    href:location.href,
    secureContext:window.isSecureContext,
    geolocationAPI:Boolean(navigator.geolocation),
    userAgent:navigator.userAgent
  };
  if(!navigator.geolocation){
    result.textContent=JSON.stringify({...base,error:"Geolocation API unavailable"},null,2);
    return;
  }
  result.textContent="Requesting location...\\n"+JSON.stringify(base,null,2);
  navigator.geolocation.getCurrentPosition(
    p=>result.textContent=JSON.stringify({...base,status:"success",latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy_meters:p.coords.accuracy},null,2),
    e=>result.textContent=JSON.stringify({...base,status:"error",error_code:e.code,error_message:e.message},null,2),
    {enableHighAccuracy:false,timeout:20000,maximumAge:0}
  );
});
</script>
</body>
</html>`);
  }

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
      licensee_name: record.fname && record.name
        ? `${record.fname} ${record.name}`.trim()
        : (record.name || null),
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
