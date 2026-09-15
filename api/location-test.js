export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`<!doctype html>
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
<p>This page only calls the browser geolocation API.</p>
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
  result.textContent="Requesting location...\n"+JSON.stringify(base,null,2);
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
