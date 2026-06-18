const waveCanvas = document.getElementById('waveCanvas');
const fftCanvas = document.getElementById('fftCanvas');
const waveCtx = waveCanvas.getContext('2d', { alpha: false });
const fftCtx = fftCanvas.getContext('2d', { alpha: false });

const levelCtrl = document.getElementById('levelCtrl');
const bitCtrl = document.getElementById('bitCtrl');
const levelVal = document.getElementById('levelVal');
const bitVal = document.getElementById('bitVal');

const btnDitherOff = document.getElementById('ditherOff');
const btnDitherOn = document.getElementById('ditherOn');
const btnShapeOff = document.getElementById('shapeOff');
const btnShapeOn = document.getElementById('shapeOn');

// State
let useDither = false;
let useShape = false;
const N = 1024; 

// Resize Handling
function resize() {
  waveCanvas.width = waveCanvas.parentElement.clientWidth;
  waveCanvas.height = 250;
  fftCanvas.width = fftCanvas.parentElement.clientWidth;
  fftCanvas.height = 250;
}
window.addEventListener('resize', resize);
resize();

// UI Events
levelCtrl.addEventListener('input', (e) => levelVal.innerText = parseFloat(e.target.value).toFixed(1));
bitCtrl.addEventListener('input', (e) => bitVal.innerText = e.target.value);

btnDitherOff.addEventListener('click', () => { useDither = false; btnDitherOff.classList.add('active'); btnDitherOn.classList.remove('active'); });
btnDitherOn.addEventListener('click', () => { useDither = true; btnDitherOn.classList.add('active'); btnDitherOff.classList.remove('active'); });
btnShapeOff.addEventListener('click', () => { useShape = false; btnShapeOff.classList.add('active'); btnShapeOn.classList.remove('active'); });
btnShapeOn.addEventListener('click', () => { useShape = true; btnShapeOn.classList.add('active'); btnShapeOff.classList.remove('active'); });

// DSP Utilities
function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function bitReverse(num, bits) {
  let res = 0;
  for (let i = 0; i < bits; i++) {
    res = (res << 1) | (num & 1);
    num >>= 1;
  }
  return res;
}

const log2N = Math.log2(N);
const revTable = new Int32Array(N);
const cosTable = new Float64Array(N / 2); // เปลี่ยนเป็น Float64 เพื่อรองรับคณิตศาสตร์ 24-bit
const sinTable = new Float64Array(N / 2);

for (let i = 0; i < N; i++) revTable[i] = bitReverse(i, log2N);
for (let i = 0; i < N / 2; i++) {
  cosTable[i] = Math.cos(-2 * Math.PI * i / N);
  sinTable[i] = Math.sin(-2 * Math.PI * i / N);
}

function computeFFT(real, imag) {
  for (let i = 0; i < N; i++) {
    let j = revTable[i];
    if (j > i) {
      let tr = real[j], ti = imag[j];
      real[j] = real[i]; imag[j] = imag[i];
      real[i] = tr; imag[i] = ti;
    }
  }
  for (let size = 2; size <= N; size *= 2) {
    let halfSize = size / 2;
    let tablestep = N / size;
    for (let i = 0; i < N; i += size) {
      for (let j = i, k = 0; j < i + halfSize; j++, k += tablestep) {
        let tpre = real[j + halfSize] * cosTable[k] - imag[j + halfSize] * sinTable[k];
        let tpim = real[j + halfSize] * sinTable[k] + imag[j + halfSize] * cosTable[k];
        real[j + halfSize] = real[j] - tpre;
        imag[j + halfSize] = imag[j] - tpim;
        real[j] += tpre;
        imag[j] += tpim;
      }
    }
  }
}

// Real-time Simulation Loop
let basePhase = 0;
const phaseSpeed = 0.05; // กำหนดความเร็วให้รูปคลื่นวิ่งช้าๆ สมูทๆ
const freq = 12.0; // ลดความถี่ลงเพื่อให้คลื่นกว้างขึ้น ซูมเห็นรอยหยัก Quantization ชัดขึ้น
let lastError = 0;

function draw() {
  const levelDb = parseFloat(levelCtrl.value);
  const bitDepth = parseInt(bitCtrl.value);
  
  const amplitude = dbToLinear(levelDb);
  const qSteps = Math.pow(2, bitDepth - 1);
  const qScale = 1 / qSteps;
  
  // ใช้ Float64Array เพื่อรักษาความแม่นยำสูงสุดในระดับ 24-bit
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  
  // อัปเดต basePhase เฟรมละนิด เพื่อไม่ให้คลื่นวิ่งเร็วเกินไปจนตาลาย
  basePhase += phaseSpeed;
  let currentPhase = basePhase;
  
  // 1. Generate Signal & Process DSP
  for (let i = 0; i < N; i++) {
    let sample = Math.sin(currentPhase) * amplitude;
    currentPhase += (Math.PI * 2 * freq) / N;
    
    let ditherVal = 0;
    if (useDither) {
      ditherVal = (Math.random() + Math.random() - 1.0) * qScale; 
    }
    
    let shapedSample = sample + ditherVal;
    if (useShape) {
      shapedSample -= lastError * 0.95; 
    }
    
    let quantized = Math.round(shapedSample / qScale) * qScale;
    lastError = quantized - sample; 
    
    real[i] = quantized;
    imag[i] = 0;
  }
  
  // 2. Draw Waveform (Slow Motion & Zoomed)
  waveCtx.fillStyle = '#000';
  waveCtx.fillRect(0, 0, waveCanvas.width, waveCanvas.height);
  
  waveCtx.beginPath();
  waveCtx.strokeStyle = '#00ffcc';
  waveCtx.lineWidth = 2;
  
  const drawAmps = amplitude < 0.1 ? 0.1 : amplitude; 
  const centerY = waveCanvas.height / 2;
  
  for (let i = 0; i < waveCanvas.width; i++) {
    let index = Math.floor((i / waveCanvas.width) * (N / 4)); 
    let y = centerY - (real[index] / drawAmps) * (waveCanvas.height * 0.4);
    if (i === 0) waveCtx.moveTo(i, y);
    else waveCtx.lineTo(i, y);
  }
  waveCtx.stroke();
  
  // 3. Compute FFT & Draw Spectrum
  computeFFT(real, imag);
  
  fftCtx.fillStyle = '#000';
  fftCtx.fillRect(0, 0, fftCanvas.width, fftCanvas.height);
  
  fftCtx.beginPath();
  fftCtx.strokeStyle = '#ff8c00';
  fftCtx.lineWidth = 2;
  
  for (let i = 0; i < N / 2; i++) {
    let mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / (N / 2);
    let db = 20 * Math.log10(mag + 1e-12); // ปรับ Noise Floor พื้นฐานให้ลึกขึ้นเพื่อแสดงผล 24-bit
    
    // ขยายแกน Y ให้เห็นถึง -144dB (ทฤษฎี 24-bit)
    let y = fftCanvas.height - ((db + 150) / 150) * fftCanvas.height;
    let x = (i / (N / 2)) * fftCanvas.width;
    
    if (i === 0) fftCtx.moveTo(x, y);
    else fftCtx.lineTo(x, y);
  }
  fftCtx.stroke();
  
  fftCtx.lineTo(fftCanvas.width, fftCanvas.height);
  fftCtx.lineTo(0, fftCanvas.height);
  fftCtx.fillStyle = 'rgba(255, 140, 0, 0.1)';
  fftCtx.fill();
  
  requestAnimationFrame(draw);
}

draw();