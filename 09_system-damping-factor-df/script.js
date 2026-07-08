document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const elSpkImp = document.getElementById('spk-imp');
  const elAmpDf = document.getElementById('amp-df');
  const elAmpDfVal = document.getElementById('amp-df-val');
  const elCabLen = document.getElementById('cab-len');
  const elCabLenVal = document.getElementById('cab-len-val');
  const elCabGauge = document.getElementById('cab-gauge');
  
  const elResVal = document.getElementById('res-val');
  const elDfVal = document.getElementById('df-val');
  const elDfStatus = document.getElementById('df-status');
  
  const canvas = document.getElementById('transientCanvas');
  const ctx = canvas.getContext('2d');

  // Constants for Physics Math
  const RHO_COPPER = 0.0171; // Resistivity of copper (Ohm * mm^2 / m)

  // Resize canvas for sharp rendering
  function resizeCanvas() {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    calculateAndDraw();
  }

  // Main DSP Calculation Function
  function calculateAndDraw() {
    // 1. Get Values
    const zSpk = parseFloat(elSpkImp.value);
    const ampRatedDf = parseFloat(elAmpDf.value);
    const cabLen = parseFloat(elCabLen.value);
    const cabGauge = parseFloat(elCabGauge.value);

    // 2. Compute Math
    // Z_Amp is derived from Amp's rated DF at 8 ohms standard
    const zAmp = 8.0 / ampRatedDf;
    
    // Cable Resistance: R = rho * (2 * Length) / Area
    const rCable = (RHO_COPPER * (2 * cabLen)) / cabGauge;
    
    // System Damping Factor: DF = Z_Speaker / (Z_Amp + R_Cable)
    const dfTotal = zSpk / (zAmp + rCable);

    // 3. Update UI Values
    elResVal.textContent = rCable.toFixed(3) + ' Ω';
    elDfVal.textContent = dfTotal.toFixed(1);

    // 4. Update Status Badge Color
    if (dfTotal < 20) {
      elDfVal.style.color = '#ff3333';
      elDfStatus.style.backgroundColor = '#ff3333';
      elDfStatus.textContent = 'CRITICAL (LOOSE BASS)';
    } else if (dfTotal < 50) {
      elDfVal.style.color = '#ffcc00';
      elDfStatus.style.backgroundColor = '#ffcc00';
      elDfStatus.style.color = '#000';
      elDfStatus.textContent = 'ACCEPTABLE';
    } else {
      elDfVal.style.color = '#00cc66';
      elDfStatus.style.backgroundColor = '#00cc66';
      elDfStatus.style.color = '#fff';
      elDfStatus.textContent = 'OPTIMAL (TIGHT BASS)';
    }

    // 5. Render Canvas (Back EMF Transient Simulation)
    drawTransient(dfTotal);
  }

  // Draw Damped Sine Wave based on DF
  function drawTransient(df) {
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Mapping DF to a Decay Envelope (Tau)
    // Low DF = slow decay (rings). High DF = fast decay (stops).
    // Math model: y = A * cos(2*pi*f*t) * exp(-t * decayFactor)
    const baseDecay = 5; 
    const maxDecay = 120;
    // Compress DF mapping so visual changes make sense in 0-200 range
    const mappedDecay = baseDecay + Math.min(df * 1.5, maxDecay); 
    
    const freq = 60; // 60Hz Subwoofer freq
    const timeScale = 0.15; // simulate 150ms window
    
    ctx.beginPath();
    ctx.strokeStyle = df < 20 ? '#ff3333' : '#ff8c00'; // Change wave color if critical
    ctx.lineWidth = 3;
    
    for (let x = 0; x < width; x++) {
      let t = (x / width) * timeScale;
      // Synthesize signal: Impact + Ringing
      let envelope = Math.exp(-t * mappedDecay);
      let wave = Math.cos(2 * Math.PI * freq * t);
      
      let amplitude = (height / 2.5);
      let y = (height / 2) - (wave * envelope * amplitude);
      
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under wave slightly for aesthetics
    ctx.lineTo(width, height/2);
    ctx.lineTo(0, height/2);
    ctx.fillStyle = df < 20 ? 'rgba(255, 51, 51, 0.1)' : 'rgba(255, 140, 0, 0.1)';
    ctx.fill();
  }

  // Event Listeners for UI interaction
  const inputs = [elSpkImp, elCabGauge];
  inputs.forEach(input => input.addEventListener('change', calculateAndDraw));

  elAmpDf.addEventListener('input', (e) => {
    elAmpDfVal.textContent = e.target.value;
    calculateAndDraw();
  });

  elCabLen.addEventListener('input', (e) => {
    elCabLenVal.textContent = e.target.value + ' m';
    calculateAndDraw();
  });

  window.addEventListener('resize', resizeCanvas);

  // Init
  resizeCanvas();
});