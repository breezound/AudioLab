const canvas = document.getElementById('rtaCanvas');
const ctx = canvas.getContext('2d');

const inputs = {
  gain: document.getElementById('inputGain'),
  phase: document.getElementById('phaseShift'),
  ceiling: document.getElementById('ceiling'),
  os: document.getElementById('oversampling')
};

const labels = {
  gain: document.getElementById('lblGain'),
  phase: document.getElementById('lblPhase'),
  ceil: document.getElementById('lblCeil')
};

const meters = {
  sampleFill: document.getElementById('sampleMeter'),
  sampleReadout: document.getElementById('sampleReadout'),
  trueFill: document.getElementById('trueMeter'),
  trueReadout: document.getElementById('trueReadout'),
  clipWarn: document.getElementById('clipWarn')
};

// Math Helpers
const toLin = db => Math.pow(10, db / 20);
const toDB = lin => lin <= 0.0001 ? -144 : 20 * Math.log10(lin);

function draw() {
  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;
  const scaleY = height / 3.5; // Allow headroom up to ~1.75 linear (+4.8 dB)
  
  // Get Values
  const gainDB = parseFloat(inputs.gain.value);
  const phaseDeg = parseFloat(inputs.phase.value);
  const ceilDB = parseFloat(inputs.ceiling.value);
  const os = parseInt(inputs.os.value);
  
  // Update Labels
  labels.gain.textContent = gainDB > 0 ? `+${gainDB.toFixed(1)}` : gainDB.toFixed(1);
  labels.phase.textContent = phaseDeg.toFixed(0);
  labels.ceil.textContent = ceilDB.toFixed(1);
  
  const baseAmp = toLin(gainDB);
  const ceilLin = toLin(ceilDB);
  
  // Signal config: Frequency is Fs/4 -> 4 samples per cycle at 1x OS
  const cycleWidth = 200; // pixels per cycle
  const baseSamplesPerCycle = 4;
  const totalSamples = Math.ceil(width / cycleWidth) * baseSamplesPerCycle;
  
  // 1. Limiter Detection Stage
  let maxDetectedSample = 0;
  const detectionMultiplier = os; // Oversampling multiplier
  const detectionSamplesPerCycle = baseSamplesPerCycle * detectionMultiplier;
  const totalDetectionSamples = Math.ceil(width / cycleWidth) * detectionSamplesPerCycle;
  
  for (let i = 0; i < totalDetectionSamples; i++) {
    // Phase shift affects the relative position of the wave to the sample clock
    const rad = (i / detectionSamplesPerCycle) * Math.PI * 2 + (phaseDeg * Math.PI / 180);
    const val = Math.abs(baseAmp * Math.sin(rad));
    if (val > maxDetectedSample) maxDetectedSample = val;
  }
  
  // 2. Limiter Gain Reduction
  const limiterGain = maxDetectedSample > ceilLin ? (ceilLin / maxDetectedSample) : 1.0;
  
  // 3. Output Calculation
  const outputAmp = baseAmp * limiterGain;
  
  // Clear Canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  // Draw Grid & dBFS Lines
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#222';
  for(let i=0; i<=width; i+=50) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
  }
  
  // 0 dBFS Line (Digital Max)
  const y0 = centerY - (1.0 * scaleY);
  const y0_neg = centerY + (1.0 * scaleY);
  ctx.strokeStyle = '#f44336'; // Red
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(width, y0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, y0_neg); ctx.lineTo(width, y0_neg); ctx.stroke();
  
  // Ceiling Line
  const yCeil = centerY - (ceilLin * scaleY);
  const yCeil_neg = centerY + (ceilLin * scaleY);
  ctx.strokeStyle = '#ff9800'; // Orange
  ctx.beginPath(); ctx.moveTo(0, yCeil); ctx.lineTo(width, yCeil); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, yCeil_neg); ctx.lineTo(width, yCeil_neg); ctx.stroke();
  ctx.setLineDash([]);
  
  // 4. Draw Continuous Wave (Reconstructed Analog)
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#00bcd4'; // Cyan
  ctx.beginPath();
  for(let x=0; x<=width; x++) {
    const rad = (x / cycleWidth) * Math.PI * 2 + (phaseDeg * Math.PI / 180);
    const y = centerY - (Math.sin(rad) * outputAmp * scaleY);
    if(x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Draw Clipping Highlights (Analog clipping above 0 dBFS)
  ctx.fillStyle = 'rgba(244, 67, 54, 0.3)';
  for(let x=0; x<=width; x++) {
    const rad = (x / cycleWidth) * Math.PI * 2 + (phaseDeg * Math.PI / 180);
    const yVal = Math.sin(rad) * outputAmp;
    if(yVal > 1.0) {
      const y = centerY - (yVal * scaleY);
      ctx.fillRect(x, y, 1, y0 - y);
    } else if (yVal < -1.0) {
      const y = centerY - (yVal * scaleY);
      ctx.fillRect(x, y0_neg, 1, y - y0_neg);
    }
  }

  // 5. Draw Digital Sample Points (What the base ADC/DAC clock sees)
  let actualSampleMax = 0;
  for(let i=0; i<totalSamples; i++) {
    const x = i * (cycleWidth / baseSamplesPerCycle);
    const rad = (x / cycleWidth) * Math.PI * 2 + (phaseDeg * Math.PI / 180);
    const rawVal = Math.sin(rad) * outputAmp;
    if(Math.abs(rawVal) > actualSampleMax) actualSampleMax = Math.abs(rawVal);
    
    const y = centerY - (rawVal * scaleY);
    
    // Stem
    ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, centerY); ctx.lineTo(x, y); ctx.stroke();
    
    // Point
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI*2);
    ctx.fill();
  }

  // 6. Update Meters
  const sampleDB = toDB(actualSampleMax);
  const trueDB = toDB(outputAmp); // Sine wave True Peak is exactly its amplitude
  
  meters.sampleReadout.textContent = sampleDB > -100 ? sampleDB.toFixed(2) : '-inf';
  meters.trueReadout.textContent = trueDB > -100 ? trueDB.toFixed(2) : '-inf';
  
  // Map -24dB to 0dB to 0%-100%
  const mapWidth = db => Math.max(0, Math.min(100, (db + 24) / 24 * 100));
  meters.sampleFill.style.width = `${mapWidth(sampleDB)}%`;
  meters.trueFill.style.width = `${mapWidth(trueDB)}%`;
  
  if(trueDB > 0.001) {
    meters.clipWarn.classList.add('active');
    meters.trueReadout.style.color = '#f44336';
  } else {
    meters.clipWarn.classList.remove('active');
    meters.trueReadout.style.color = '#fff';
  }
}

// Event Listeners
Object.values(inputs).forEach(input => {
  input.addEventListener('input', draw);
});

// Initial Render
draw();