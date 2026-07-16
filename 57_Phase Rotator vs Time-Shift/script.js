document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const canvas = document.getElementById('bz-oscilloscope');
  const ctx = canvas.getContext('2d');
  const meterBar = document.getElementById('bz-vu-meter');
  
  const modeSelect = document.getElementById('bz-mode-select');
  const panelTime = document.getElementById('panel-time');
  const panelAPF = document.getElementById('panel-apf');
  
  const ctrlDelay = document.getElementById('ctrl-delay');
  const ctrlFreq = document.getElementById('ctrl-freq');
  const ctrlPhase = document.getElementById('ctrl-phase');
  const ctrlQ = document.getElementById('ctrl-q');
  
  const valDelay = document.getElementById('val-delay');
  const valFreq = document.getElementById('val-freq');
  const valPhase = document.getElementById('val-phase');
  const valQ = document.getElementById('val-q');
  
  const warnDelay = document.getElementById('warn-delay');
  const warnQ = document.getElementById('warn-q');

  // Canvas Setup
  let width, height;
  function resizeCanvas() {
    width = canvas.parentElement.clientWidth - 20; // Padding offset
    height = 250;
    canvas.width = width;
    canvas.height = height;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // DSP Simulation Parameters
  const SIM_DURATION_MS = 25.0; // Render 25ms of audio timeframe
  const HIT_TIME_MS = 4.0; // Drum hit starts at 4ms (Reference)
  const TGT_INITIAL_DELAY = 1.5; // Target mic naturally delayed by 1.5ms (Phase offset)
  
  // UI Event Listeners
  modeSelect.addEventListener('change', (e) => {
    if(e.target.value === 'time') {
      panelTime.style.display = 'block';
      panelAPF.style.display = 'none';
    } else {
      panelTime.style.display = 'none';
      panelAPF.style.display = 'block';
    }
  });

  const updateLabels = () => {
    valDelay.innerText = parseFloat(ctrlDelay.value).toFixed(1);
    valFreq.innerText = ctrlFreq.value;
    valPhase.innerText = ctrlPhase.value;
    valQ.innerText = parseFloat(ctrlQ.value).toFixed(1);
    
    // Warn UI logic
    warnDelay.style.opacity = Math.abs(parseFloat(ctrlDelay.value)) > 0.5 ? 1 : 0;
    warnQ.style.opacity = parseFloat(ctrlQ.value) > 4.0 ? 1 : 0;
  };

  [ctrlDelay, ctrlFreq, ctrlPhase, ctrlQ].forEach(ctrl => {
    ctrl.addEventListener('input', updateLabels);
  });

  // Math Helpers
  const envelope = (t, startT, decay) => {
    if (t < startT) return 0;
    return Math.exp(-(t - startT) * decay) * Math.min((t - startT) * 2.0, 1.0); // Fast attack, exp decay
  };

  // Rendering Loop
  function draw() {
    ctx.clearRect(0, 0, width, height);
    
    const mode = modeSelect.value;
    const uDelay = parseFloat(ctrlDelay.value);
    const uFreq = parseFloat(ctrlFreq.value);
    const uPhase = parseFloat(ctrlPhase.value) * (Math.PI / 180);
    const uQ = parseFloat(ctrlQ.value);
    
    const centerY = height / 2;
    const amplitude = height * 0.25; // Scale waves

    let maxSum = 0; // For VU meter

    ctx.lineWidth = 2;
    
    const pathRef = new Path2D();
    const pathTgt = new Path2D();
    const pathSum = new Path2D();

    // Iterate through X pixels (Time domain)
    for (let x = 0; x < width; x++) {
      const t = (x / width) * SIM_DURATION_MS; // Current time in ms
      const tSec = t / 1000.0;
      
      // 1. Reference Signal (Fixed)
      const refEnv = envelope(t, HIT_TIME_MS, 0.4);
      const refOsc = Math.sin(2 * Math.PI * uFreq * tSec);
      const yRef = refEnv * refOsc;
      
      // 2. Target Signal Processing
      let yTgt = 0;
      const tgtBaseTime = HIT_TIME_MS + TGT_INITIAL_DELAY;
      
      if (mode === 'time') {
        // TIME-SHIFT: Shifts the entire envelope and oscillation
        const shiftedTime = tgtBaseTime + uDelay;
        const tgtEnv = envelope(t, shiftedTime, 0.4);
        // Initially flipped phase to simulate cancellation issue
        const tgtOsc = Math.sin(2 * Math.PI * uFreq * (tSec - (shiftedTime/1000))) * -1.0; 
        yTgt = tgtEnv * tgtOsc;
      } else {
        // ALL-PASS FILTER: Envelope stays at natural delay, only phase of freq rotates
        const tgtEnv = envelope(t, tgtBaseTime, 0.4);
        const naturalOsc = Math.sin(2 * Math.PI * uFreq * (tSec - (tgtBaseTime/1000))) * -1.0;
        
        // Apply phase rotation math approximation
        const rotatedOsc = Math.sin((2 * Math.PI * uFreq * (tSec - (tgtBaseTime/1000))) + uPhase) * -1.0;
        
        // Simulate Group Delay (Transient Smearing / Ringing) based on High Q
        let ringing = 0;
        if (uQ > 1.0) {
           const ringDecay = 1.0 / uQ;
           const ringEnv = envelope(t, tgtBaseTime + 0.5, ringDecay);
           ringing = ringEnv * Math.sin(2 * Math.PI * uFreq * tSec) * (uQ * 0.05);
        }
        
        yTgt = (tgtEnv * rotatedOsc) + ringing;
      }

      // 3. Summation
      const ySum = yRef + yTgt;
      maxSum = Math.max(maxSum, Math.abs(ySum));

      // Draw plotting
      const pxRef = centerY - (yRef * amplitude);
      const pxTgt = centerY - (yTgt * amplitude);
      const pxSum = centerY - (ySum * amplitude * 1.2); // slight boost for visibility

      if (x === 0) {
        pathRef.moveTo(x, pxRef);
        pathTgt.moveTo(x, pxTgt);
        pathSum.moveTo(x, pxSum);
      } else {
        pathRef.lineTo(x, pxRef);
        pathTgt.lineTo(x, pxTgt);
        pathSum.lineTo(x, pxSum);
      }
    }

    // Render Target (Red)
    ctx.strokeStyle = '#ff0055';
    ctx.globalAlpha = 0.6;
    ctx.stroke(pathTgt);

    // Render Ref (Blue)
    ctx.strokeStyle = '#00d2ff';
    ctx.globalAlpha = 0.6;
    ctx.stroke(pathRef);

    // Render Sum (Orange Accent)
    ctx.strokeStyle = '#ff8c00';
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 3;
    ctx.stroke(pathSum);
    
    // Grid Lines (Aesthetic)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Update VU Meter
    // Perfect constructive sum of 2 identical waves = 2.0 peak. 
    const meterVal = Math.min((maxSum / 2.2) * 100, 100);
    meterBar.style.width = `${meterVal}%`;

    requestAnimationFrame(draw);
  }

  // Initialize
  updateLabels();
  requestAnimationFrame(draw);
});