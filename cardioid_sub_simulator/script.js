const canvas = document.getElementById('polarCanvas');
const ctx = canvas.getContext('2d');
const c_speed = 343; // Speed of sound (m/s)

// UI Elements
const ui = {
  modeEndfire: document.getElementById('btnEndfire'),
  modeGradient: document.getElementById('btnGradient'),
  freq: document.getElementById('slFreq'),
  spacing: document.getElementById('slSpacing'),
  delayA: document.getElementById('slDelayA'),
  delayB: document.getElementById('slDelayB'),
  gainB: document.getElementById('slGainB'),
  polB: document.getElementById('chkPolB'),
  // Outputs
  outFreq: document.getElementById('outFreq'),
  outSpacing: document.getElementById('outSpacing'),
  outDelayA: document.getElementById('outDelayA'),
  outDelayB: document.getElementById('outDelayB'),
  outGainB: document.getElementById('outGainB'),
  txtPolB: document.getElementById('txtPolB')
};

let currentMode = 'endfire';

function init() {
  attachListeners();
  calculatePreset();
  drawSimulator();
}

function attachListeners() {
  ui.modeEndfire.addEventListener('click', () => setMode('endfire'));
  ui.modeGradient.addEventListener('click', () => setMode('gradient'));
  
  const sliders = [ui.freq, ui.spacing, ui.delayA, ui.delayB, ui.gainB];
  sliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      updateDisplays();
      if(e.target === ui.spacing) calculatePreset(); 
      else if(e.target !== ui.freq) customMode();
      drawSimulator();
    });
  });

  ui.polB.addEventListener('change', () => {
    updateDisplays();
    customMode();
    drawSimulator();
  });
}

function setMode(mode) {
  currentMode = mode;
  ui.modeEndfire.classList.toggle('active', mode === 'endfire');
  ui.modeGradient.classList.toggle('active', mode === 'gradient');
  calculatePreset();
  drawSimulator();
}

function customMode() {
  currentMode = 'custom';
  ui.modeEndfire.classList.remove('active');
  ui.modeGradient.classList.remove('active');
}

function calculatePreset() {
  const d = parseFloat(ui.spacing.value);
  const acousticDelayMs = (d / c_speed) * 1000;

  if (currentMode === 'endfire') {
    ui.delayB.value = 0;
    ui.delayA.value = acousticDelayMs.toFixed(2);
    ui.gainB.value = 0;
    ui.polB.checked = false;
  } else if (currentMode === 'gradient') {
    ui.delayA.value = 0;
    ui.delayB.value = acousticDelayMs.toFixed(2);
    ui.gainB.value = -1.0; // Typical Equal Magnitude compensation
    ui.polB.checked = true;
  }
  updateDisplays();
}

function updateDisplays() {
  ui.outFreq.textContent = ui.freq.value;
  ui.outSpacing.textContent = ui.spacing.value;
  ui.outDelayA.textContent = parseFloat(ui.delayA.value).toFixed(2);
  ui.outDelayB.textContent = parseFloat(ui.delayB.value).toFixed(2);
  ui.outGainB.textContent = parseFloat(ui.gainB.value).toFixed(1);
  
  if(ui.polB.checked) {
    ui.txtPolB.textContent = 'INVERTED (180°)';
    ui.txtPolB.classList.add('pol-inverted');
  } else {
    ui.txtPolB.textContent = 'NORMAL (0°)';
    ui.txtPolB.classList.remove('pol-inverted');
  }
}

function drawSimulator() {
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = (Math.min(width, height) / 2) - 40;

  // Clear Canvas
  ctx.clearRect(0, 0, width, height);

  // Draw Grid (-30dB to 0dB)
  ctx.strokeStyle = '#33333c';
  ctx.lineWidth = 1;
  const dBRings = [0, -6, -12, -18, -24];
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '10px Inter';

  dBRings.forEach(db => {
    const r = mapDBtoRadius(db, maxRadius);
    if(r <= 0) return;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#666';
    ctx.fillText(`${db}dB`, cx, cy - r - 6);
  });

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx, 20); ctx.lineTo(cx, height - 20);
  ctx.moveTo(20, cy); ctx.lineTo(width - 20, cy);
  ctx.stroke();

  // DSP Math for Plot
  const f = parseFloat(ui.freq.value);
  const d = parseFloat(ui.spacing.value);
  const delA = parseFloat(ui.delayA.value) / 1000;
  const delB = parseFloat(ui.delayB.value) / 1000;
  const gainB_lin = Math.pow(10, parseFloat(ui.gainB.value) / 20);
  const phaseInvert = ui.polB.checked ? Math.PI : 0;

  ctx.beginPath();
  ctx.strokeStyle = '#ff8c00';
  ctx.lineWidth = 3;
  ctx.fillStyle = 'rgba(255, 140, 0, 0.2)';

  for (let ang = 0; ang <= 360; ang++) {
    const rad = ang * Math.PI / 180;
    
    // Acoustic Path Difference (0 deg is audience/up, 180 deg is stage/down)
    const tA_acoust = -(d/2)/c_speed * Math.cos(rad);
    const tB_acoust =  (d/2)/c_speed * Math.cos(rad);

    const tA_total = delA + tA_acoust;
    const tB_total = delB + tB_acoust;

    const phiA = -2 * Math.PI * f * tA_total;
    const phiB = -2 * Math.PI * f * tB_total + phaseInvert;

    // Complex Sum
    const Re = Math.cos(phiA) + gainB_lin * Math.cos(phiB);
    const Im = Math.sin(phiA) + gainB_lin * Math.sin(phiB);
    const mag = Math.sqrt(Re*Re + Im*Im);

    // Convert to dB relative to max potential sum (Magnitude 2.0 = 0dB reference)
    let mag_dB = 20 * Math.log10(Math.max(mag, 0.00001)) - 6.02;

    const r = mapDBtoRadius(mag_dB, maxRadius);
    const x = cx + r * Math.sin(rad);
    const y = cy - r * Math.cos(rad);

    if (ang === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();

  // Draw Speakers
  drawSpeakers(cx, cy, maxRadius, d);
}

function mapDBtoRadius(db, maxR) {
  const minDB = -30; // Center is -30dB
  if (db <= minDB) return 0;
  return (db - minDB) / (0 - minDB) * maxR;
}

function drawSpeakers(cx, cy, maxR, spacingMeters) {
  // Map physical spacing to canvas pixels roughly
  // 3.0 meters = max spacing visual
  const visualSpacing = (spacingMeters / 3.0) * (maxR * 0.3);
  
  const spkWidth = 30;
  const spkHeight = 20;

  // Sub A (Front / Downstage) - Positioned Top (-y)
  ctx.fillStyle = '#00bcd4';
  ctx.fillRect(cx - spkWidth/2, cy - visualSpacing/2 - spkHeight/2, spkWidth, spkHeight);
  
  // Sub B (Rear / Upstage) - Positioned Bottom (+y)
  ctx.fillStyle = '#e91e63';
  ctx.fillRect(cx - spkWidth/2, cy + visualSpacing/2 - spkHeight/2, spkWidth, spkHeight);

  // Labels A B
  ctx.fillStyle = '#111';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('A', cx, cy - visualSpacing/2);
  ctx.fillText('B', cx, cy + visualSpacing/2);
}

// Bootstrap
init();