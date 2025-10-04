/* script.js — Enhanced project behavior per user's spec.
   - Dynamic forecast cards with Chart.js gradients (3D-ish feel)
   - Emojis adapt to weather description
   - Moon card with SunCalc
   - Search and Compesa with graceful behavior
   - Leaflet map responsive
   - Audio player uses assets/lua_vozinha.wav (placeholder included)
*/

// ------ CONFIG ------
const API_KEY = "582c1a981cd2720482ca8a74be18cd98"; // sua chave (você pediu que eu a inserisse) 
const DEFAULT_CITIES = [
  {q:"Gramado,BR", label:"Gramado"},
  {q:"São Paulo,BR", label:"São Paulo"},
  {q:"Recife,BR", label:"Recife"},
  {q:"Miami,US", label:"Miami"},
  {q:"Lisboa,PT", label:"Lisboa"}
];

// helper: emoji mapping
function getWeatherEmoji(desc, temp){
  desc=(desc||"").toLowerCase();
  if(desc.includes("clear")||desc.includes("limpo")||desc.includes("sun")) return "🌞"+(temp>30?" 🔥":"");
  if(desc.includes("cloud")||desc.includes("nublado")||desc.includes("nuvem")) return "☁️"+(temp<10?" 🥶":"");
  if(desc.includes("rain")||desc.includes("chuva")) return "🌧️";
  if(desc.includes("snow")||desc.includes("neve")) return "❄️";
  if(desc.includes("thunder")||desc.includes("trovoada")) return "🌩️";
  return "🌡️";
}

// create forecast cards dynamically
function createForecastCard(id, label){
  const container = document.getElementById('forecast-grid');
  const card = document.createElement('div');
  card.className = 'card forecast-card';
  card.innerHTML = `
    <h3>${label}</h3>
    <div class="emoji-row" id="${id}-emoji">🌞 ☁️ 🌧️ ❄️ 🌙 🥶 🔥</div>
    <div class="info" id="${id}-temp">--°C</div>
    <div class="info muted" id="${id}-desc">Carregando...</div>
    <div class="meta-row"><div id="${id}-extra">--</div><div id="${id}-wind">--</div></div>
    <canvas id="${id}-chart"></canvas>
  `;
  container.appendChild(card);
}

// init forecast cards
DEFAULT_CITIES.forEach((c,i)=> createForecastCard('city'+i, c.label));

// fetch weather and draw chart (uses OpenWeather forecast API)
async function loadWeatherForCity(query, ids){
  try{
    const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${API_KEY}`);
    const geo = await geoRes.json();
    if(!geo || !geo[0]) return console.warn('geo not found for', query);
    const {lat,lon,name} = geo[0];
    const wRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=pt_br`);
    const w = await wRes.json();
    const now = w.list[0];
    const temp = now.main.temp;
    document.getElementById(ids.temp).innerText = `${name}: ${temp.toFixed(1)}°C`;
    document.getElementById(ids.desc).innerText = getWeatherEmoji(now.weather[0].description,temp) + ' ' + now.weather[0].description;
    document.getElementById(ids.extra).innerText = now.weather[0].description;
    document.getElementById(ids.wind).innerText = `Vento: ${(now.wind.speed*3.6).toFixed(1)} km/h | Umidade: ${now.main.humidity}%`;

    // prepare chart data (first 6 entries ~24h)
    const slice = w.list.slice(0,6);
    const labels = slice.map((d,i)=> i===0 ? "Agora" : (new Date(d.dt*1000)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
    const max = slice.map(d=>d.main.temp_max);
    const min = slice.map(d=>d.main.temp_min);

    const ctx = document.getElementById(ids.chart).getContext('2d');
    if(ctx._chart) ctx._chart.destroy();

    // gradient for 3D-ish feel
    const grad = ctx.createLinearGradient(0,0,0,160);
    grad.addColorStop(0, 'rgba(167,112,239,0.45)');
    grad.addColorStop(1, 'rgba(0,243,255,0.06)');

    ctx._chart = new Chart(ctx, {
      type:'line',
      data:{labels, datasets:[
        {label:'Máx', data: max, borderColor:'#ff7b7b', backgroundColor: grad, tension:0.35, fill:true, pointRadius:4, borderWidth:2},
        {label:'Mín', data: min, borderColor:'#7fb7ff', tension:0.35, pointRadius:3, borderWidth:2}
      ]},
      options:{
        plugins:{legend:{labels:{color:'#fff'}}},
        scales:{x:{ticks:{color:'#fff'}}, y:{ticks:{color:'#fff'}}},
        elements:{line:{cap:'round'}},
        interaction:{mode:'index',intersect:false}
      }
    });

  }catch(err){ console.error("Erro loadWeatherForCity:", err); }
}

// tie default cities to UI ids and load them
DEFAULT_CITIES.forEach((c,i)=>{
  const ids = {temp:`city${i}-temp`, desc:`city${i}-desc`, extra:`city${i}-extra`, wind:`city${i}-wind`, chart:`city${i}-chart`};
  // ensure elements exist (they were created earlier)
  loadWeatherForCity(c.q, ids);
});

// SEARCH behavior
document.addEventListener('DOMContentLoaded', ()=>{
  // buttons
  document.getElementById('btnSearch').addEventListener('click', async ()=>{
    const q = document.getElementById('search').value.trim();
    if(!q) return document.getElementById('search-result').innerText = "Digite uma cidade.";
    document.getElementById('search-result').innerText = "Buscando...";
    try{
      const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${API_KEY}`);
      const geo = await geoRes.json();
      if(!geo || !geo[0]) return document.getElementById('search-result').innerText = "Cidade não encontrada.";
      const name = geo[0].name + (geo[0].state?(", "+geo[0].state):"") + (geo[0].country?(", "+geo[0].country):"");
      document.getElementById('search-result').innerHTML = `<strong>${name}</strong> — lat ${geo[0].lat.toFixed(3)}, lon ${geo[0].lon.toFixed(3)}`;
      map.setView([geo[0].lat,geo[0].lon],8);
      // optionally load weather for this found city into first forecast card (graceful)
      loadWeatherForCity(`${geo[0].name},${geo[0].country}`, {temp:'city0-temp', desc:'city0-desc', extra:'city0-extra', wind:'city0-wind', chart:'city0-chart'});
    }catch(e){ console.error(e); document.getElementById('search-result').innerText = "Erro na busca." }
  });

  document.getElementById('btnMoonSearch').addEventListener('click', async ()=>{
    const q = document.getElementById('moon-search').value.trim();
    if(!q) return alert("Digite cidade (ex: Gravata, BR)");
    try{
      const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${API_KEY}`);
      const geo = await geoRes.json();
      if(!geo || !geo[0]) return alert("Local não encontrado.");
      const lat = geo[0].lat, lon = geo[0].lon;
      updateMoonFor(lat,lon, geo[0].name);
      map.setView([lat,lon],6);
    }catch(e){ console.error(e); alert("Erro ao buscar cidade."); }
  });

  document.getElementById('btnCompesa').addEventListener('click', ()=>{
    const cep = document.getElementById('cep').value.trim();
    if(!cep) return document.getElementById('compesa-result').innerText = "Digite um CEP válido.";
    const dias = ["Segunda","Quarta","Sexta"];
    const dia = dias[Math.floor(Math.random()*dias.length)];
    document.getElementById('compesa-result').innerText = `Próximo abastecimento provável: ${dia}-feira (simulação).`;
  });

  // audio player
  const audioToggleBtn = document.getElementById('audio-toggle');
  const audioTrackName = document.getElementById('audio-track-name');
  let audio = new Audio();
  audio.src = "assets/lua_vozinha.wav";
  let playing = false;
  audioToggleBtn.addEventListener('click', ()=>{
    if(!playing){ audio.play().catch(()=>alert("Não foi possível tocar o áudio local. Coloque 'assets/lua_vozinha.wav' na pasta assets.")); audioToggleBtn.innerText='⏸'; playing=true }
    else { audio.pause(); audioToggleBtn.innerText='▶'; playing=false }
  });
  audio.addEventListener('error', ()=>{ audioTrackName.innerText = "arquivo: lua_vozinha.wav (não encontrado)"; });

  // init map and markers
  window.map = L.map('map',{attributionControl:true}).setView([0,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OpenStreetMap contributors'}).addTo(map);
  const coords = [[-22.9,-43.2,"Rio"],[-23.55,-46.63,"São Paulo"],[-8.05,-34.9,"Recife"]];
  coords.forEach(c=> L.marker([c[0],c[1]]).addTo(map).bindPopup(`<strong>${c[2]}</strong>`));
  window.addEventListener('resize', ()=> map.invalidateSize());
  setTimeout(()=> map.invalidateSize(),700);

  // stars
  const stars = document.getElementById('stars');
  for(let i=0;i<160;i++){ const s=document.createElement('div'); s.className='star'; s.style.top=(Math.random()*100)+'%'; s.style.left=(Math.random()*100)+'%'; s.style.animationDuration=(1.4+Math.random()*3.2)+'s'; stars.appendChild(s); }

  // default moon (near Gravata)
  updateMoonFor(-8.0,-35.3,"Gravata, BR");

  // footer year
  document.getElementById('year').innerText = new Date().getFullYear();
});

// -----------------------------
// Moon card helpers (SunCalc)
function formatAMPM(date){
  return date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:true});
}
function moonPhaseName(phase){
  if(phase===0 || phase===1) return ["Nova","🌑"];
  if(phase>0 && phase<0.25) return ["Crescente","🌒"];
  if(Math.abs(phase-0.25)<0.01) return ["Quarto Crescente","🌓"];
  if(phase>0.25 && phase<0.5) return ["Crescente Gibosa","🌔"];
  if(Math.abs(phase-0.5)<0.01) return ["Cheia","🌕"];
  if(phase>0.5 && phase<0.75) return ["Minguante Gibosa","🌖"];
  if(Math.abs(phase-0.75)<0.01) return ["Quarto Minguante","🌗"];
  return ["Minguante","🌘"];
}
function updateMoonFor(lat,lon,label){
  try{
    const now=new Date();
    const moonTimes = SunCalc.getMoonTimes(now, lat, lon);
    const illum = SunCalc.getMoonIllumination(now);
    const [name,emoji] = moonPhaseName(illum.phase);
    document.getElementById("moon-phase-icon").innerText = emoji;
    document.getElementById("moon-name").innerText = `${name} • ${label||""}`;
    document.getElementById("moon-datetime").innerText = now.toLocaleDateString('pt-BR') + " • " + formatAMPM(now);
    const rise = moonTimes.rise ? formatAMPM(moonTimes.rise) : "—";
    const setT = moonTimes.set ? formatAMPM(moonTimes.set) : "—";
    document.getElementById("moon-rise-set").innerText = `Nascer: ${rise} | Pôr: ${setT}`;

    const phrases = {
      "Cheia":"O teu brilho me torna inteira; olho pra ti e me encho de luz.",
      "Quarto Crescente":"Cada passo teu acende em mim uma nova esperança.",
      "Crescente":"Cresço por ti, como a lua que aprende a ser estrela.",
      "Minguante":"Mesmo diminuindo, guardo tudo o que me deste; há beleza em cada lembrança.",
      "Quarto Minguante":"O silêncio entre nós fala mais que qualquer palavra.",
      "Nova":"Em silêncio eu me preparo para voltar a te iluminar."
    };
    const base = phrases[name] || "Meu amor te acompanha em cada noite e em cada suspiro.";
    document.getElementById("moon-phrase").innerText = base;
    document.getElementById("moon-romantic").innerText = `"${base}"`;
  }catch(e){ console.error("Erro updateMoonFor", e); }
}
