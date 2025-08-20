// Register service worker for install/offline
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(console.error);
}

const statusEl  = document.getElementById("status");
const bigAnswer = document.getElementById("bigAnswer");
const subAnswer = document.getElementById("subAnswer");
const probEl    = document.getElementById("prob");
const sumEl     = document.getElementById("sum");
const placeEl   = document.getElementById("place");
const updatedEl = document.getElementById("updated");
const detailsEl = document.getElementById("details");
const dayLabel  = document.getElementById("dayLabel");
const yearEl    = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

// Buttons
document.getElementById("todayBtn").onclick = () => update(0);
document.getElementById("tomorrowBtn").onclick = () => update(1);
document.getElementById("refreshBtn").onclick = () => update(currentDayIndex,true);

// Detect if shortcut specified ?view=tomorrow
const params = new URLSearchParams(location.search);
let currentDayIndex = params.get("view")==="tomorrow" ? 1 : 0;
dayLabel.textContent = currentDayIndex===0 ? "Today" : "Tomorrow";

// Fallback to Nairobi CBD if geolocation not available/denied
const NAIROBI = { lat: -1.286, lon: 36.817, name:"Nairobi, KE" };

// Thresholds for umbrella decision
const RAIN_MM_THRESHOLD = 0.2; // any meaningful rain
const PROB_THRESHOLD    = 30;  // %

async function locate() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(NAIROBI);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "Your location" }),
      ()  => resolve(NAIROBI),
      { enableHighAccuracy:true, timeout:7000, maximumAge:60000 }
    );
  });
}

function decide(probMax, rainSum) {
  const needUmbrella = (probMax >= PROB_THRESHOLD) || (rainSum >= RAIN_MM_THRESHOLD);
  const emoji = needUmbrella ? "🌧️☂️" : "🌤️";
  const title = needUmbrella ? "Carry an umbrella" : "No umbrella needed";
  const sub = needUmbrella
    ? "Rain is likely. Stay dry out there."
    : "Chances are low. You should be fine.";
  return { needUmbrella, emoji, title, sub };
}

async function fetchWeather(lat, lon) {
  // Free, no-key API: Open-Meteo
  const base = "https://api.open-meteo.com/v1/forecast";
  const q = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: "precipitation_probability_max,precipitation_sum",
    timezone: "Africa/Nairobi"
  });
  const url = `${base}?${q.toString()}`;
  const res = await fetch(url, { cache:"no-store" });
  if (!res.ok) throw new Error("Network error");
  return res.json();
}

function saveCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, t: Date.now() })); } catch {}
}
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

async function update(dayIndex=0, forceRefresh=false) {
  currentDayIndex = dayIndex;
  dayLabel.textContent = dayIndex===0 ? "Today" : "Tomorrow";
  statusEl.textContent = "Getting forecast…";
  detailsEl.hidden = true;

  const loc = await locate();
  placeEl.textContent = loc.name;

  const cacheKey = `wx:${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
  let data;

  try {
    if (forceRefresh) throw new Error("skip-cache");
    const cached = readCache(cacheKey);
    if (cached && Date.now() - cached.t < 30*60*1000) { // 30 min
      data = cached.data;
    } else {
      throw new Error("stale-or-missing");
    }
  } catch {
    data = await fetchWeather(loc.lat, loc.lon).catch(err => {
      const cached = readCache(cacheKey);
      if (cached) {
        statusEl.textContent = "Offline — showing last saved result";
        return cached.data;
      }
      throw err;
    });
    saveCache(cacheKey, data);
  }

  const probMax = data?.daily?.precipitation_probability_max?.[dayIndex] ?? 0;
  const rainSum = data?.daily?.precipitation_sum?.[dayIndex] ?? 0;

  const { emoji, title, sub } = decide(probMax, rainSum);
  bigAnswer.textContent = `${emoji} ${title}`;
  subAnswer.textContent = sub;

  probEl.textContent = Math.round(probMax);
  sumEl.textContent  = (Math.round(rainSum*10)/10).toFixed(1);
  updatedEl.textContent = new Date().toLocaleString("en-KE", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"short" });

  statusEl.textContent = "Ready";
  detailsEl.hidden = false;
}

// Kick off
update(currentDayIndex); 