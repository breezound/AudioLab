const canvas = document.getElementById('polarCanvas');
const ctx = canvas.getContext('2d');
const c_speed = 343; 

const ui = {
  btnEndfire: document.getElementById('btnEndfire'),
  btnGradient: document.getElementById('btnGradient'),
  slFreq: document.getElementById('slFreq'),
  slSpacing: document.getElementById('slSpacing'),
  slDelayA: document.getElementById('slDelayA'),
  slDelayB: document.getElementById('slDelayB'),
  slGainB: document.getElementById('slGainB'),
  chkPolB: document.getElementById('chkPolB'),
  outFreq: document.getElementById('outFreq'),
  outSpacing: document.getElementById('outSpacing'),
  outDelayA: document.getElementById('outDelayA'),
  outDelayB: document.getElementById('outDelayB'),
  outGainB: document.getElementById('outGainB'),
  txtPolB: document.getElementById('txtPolB')
};

let currentMode = 'endfire';

function init() {
  bindEvents();
  calcPreset();
  renderDSP();
}

function bindEvents() {
  ui.btnEndfire.addEventListener('click', () => setMode('endfire'));
  ui.btnGradient.addEventListener('click', () => setMode('gradient'));
  
  [ui.slFreq, ui.slSpacing, ui.slDelayA, ui.slDelayB, ui.slGainB].forEach(el => {
    el.addEventListener('input', (e) => {
      if(e.target === ui.slSpacing) calcPreset(); 
      else if(e.target !== ui.slFreq) clearMode();
      updateValues();
      renderDSP();
    });
  });

  ui.chkPolB.addEventListener('change', () => {
    clearMode();
    updateValues();
    renderDSP();
  });
}

function setMode(mode) {
  currentMode = mode;
  ui.btnEndfire.classList.toggle('active', mode === 'endfire');
  ui.btnGradient.classList.toggle('active', mode === 'gradient');
  calcPreset();
  renderDSP();
}

function clearMode() {
  currentMode = 'custom';
  ui.btnEndfire.classList.remove('active');
  ui.btnGradient.classList.remove('active');
}

function calcPreset() {
  const distance = parseFloat(ui.slSpacing.value);
  const acousticDelayMs = (distance / c_speed) * 1000;

  if (currentMode === 'endfire') {
    ui.slDelayB.value = 0;
    ui.slDelayA.value = acousticDelayMs.toFixed(2);
    ui.slGainB.value = 0;
    ui.chkPolB.checked = false;
  } else if (currentMode === 'gradient') {
    ui.slDelayA.value = 0;
    ui.slDelayB.value = acousticDelayMs.toFixed(2);
    ui.slGainB.value = -1.0; 
    ui.chkPolB.checked = true;
  }
  updateValues();
}

function updateValues() {
  ui.outFreq.textContent = ui.slFreq.value;
  ui.outSpacing.textContent = ui.slSpacing.value;
  ui.outDelayA.textContent = parseFloat(ui.slDelayA.value).toFixed(2);
  ui.outDelayB.textContent = parseFloat(ui.slDelayB.value).toFixed(2);
  ui.outGainB.textContent = parseFloat(ui.slGainB.value).toFixed(1);
  
  if(ui.chkPolB.checked) {
    ui.txtPolB.textContent = 'INVERTED (180°)';
    ui.txtPolB.classList.add('pol-inverted');
  } else {
    ui.txtPolB.textContent = 'NORMAL (0°)';
    ui.txtPolB.classList.remove('pol-inverted');
  }
}

function renderDSP() {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) - 45;

  ctx.clearRect(0, 0, w, h);

  // Draw Grid Map
  ctx.strokeStyle = '#2b2b36';
  ctx.lineWidth = 1;
  const dBScales = [0, -6, -12, -18, -24];
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '10px sans-serif';

  dBScales.forEach(db => {
    const r = mapDB(db, maxR);
    if(r <= 0) return;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#666';
    ctx.fillText(`${db}dB`, cx, cy - r - 8);
  });

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx, 20); ctx.lineTo(cx, h - 20);
  ctx.moveTo(20, cy); ctx.lineTo(w - 20, cy);
  ctx.stroke();

  // Variables
  const f = parseFloat(ui.slFreq.value);
  const d = parseFloat(ui.slSpacing.value);
  const delA = parseFloat(ui.slDelayA.value) / 1000;
  const delB = parseFloat(ui.slDelayB.value) / 1000;
  const gainB = Math.pow(10, parseFloat(ui.slGainB.value) / 20);
  const pol = ui.chkPolB.checked ? Math.PI : 0;

  // Render Polar Trace
  ctx.beginPath();
  ctx.strokeStyle = '#ff8c00';
  ctx.lineWidth = 3;
  ctx.fillStyle = 'rgba(255, 140, 0, 0.15)';

  for (let deg = 0; deg <= 360; deg++) {
    const rad = deg * Math.PI / 180;
    
    // Acoustic path difference
    const tA_acoust = -(d/2)/c_speed * Math.cos(rad);
    const tB_acoust =  (d/2)/c_speed * Math.cos(rad);

    const phiA = -2 * Math.PI * f * (delA + tA_acoust);
    const phiB = -2 * Math.PI * f * (delB + tB_acoust) + pol;

    // Vector Summation
    const Re = Math.cos(phiA) + gainB * Math.cos(phiB);
    const Im = Math.sin(phiA) + gainB * Math.sin(phiB);
    const mag = Math.sqrt(Re*Re + Im*Im);

    // dB Calculation relative to ideal sum (2.0)
    let mag_dB = 20 * Math.log10(Math.max(mag, 0.00001)) - 6.02;

    const r = mapDB(mag_dB, maxR);
    const px = cx + r * Math.sin(rad);
    const py = cy - r * Math.cos(rad);

    if (deg === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();

  drawHardware(cx, cy, maxR, d);
}

function mapDB(db, maxR) {
  const minDB = -30; 
  if (db <= minDB) return 0;
  return (db - minDB) / (0 - minDB) * maxR;
}

function drawHardware(cx, cy, maxR, spacingMeters) {
  const visualScale = (spacingMeters / 3.0) * (maxR * 0.35);
  const spkW = 36;
  const spkH = 22;

  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (currentMode === 'gradient') {
    // Gradient: Stacked enclosure (Top-down views overlapping, using depth)
    ctx.fillStyle = '#16161a';
    ctx.strokeStyle = '#2b2b36';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - spkW/2, cy - visualScale/2, spkW, visualScale);
    ctx.strokeRect(cx - spkW/2, cy - visualScale/2, spkW, visualScale);

    // Sub A (Front Face)
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(cx - spkW/2, cy - visualScale/2 - 4, spkW, 6);
    ctx.fillStyle = '#fff';
    ctx.fillText('A', cx, cy - visualScale/4);

    // Sub B (Rear Face)
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(cx - spkW/2, cy + visualScale/2 - 2, spkW, 6);
    ctx.fillStyle = '#fff';
    ctx.fillText('B', cx, cy + visualScale/4);

  } else {
    // Endfire: Physically separated along Y axis
    // Sub A (Front)
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(cx - spkW/2, cy - visualScale/2 - spkH/2, spkW, spkH);
    ctx.fillStyle = '#000';
    ctx.fillText('A', cx, cy - visualScale/2);
    
    // Sub B (Rear)
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(cx - spkW/2, cy + visualScale/2 - spkH/2, spkW, spkH);
    ctx.fillStyle = '#fff';
    ctx.fillText('B', cx, cy + visualScale/2);
  }
}

document.addEventListener('DOMContentLoaded', init);