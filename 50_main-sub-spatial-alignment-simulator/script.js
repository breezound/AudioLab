// Complex Math Helper for DSP Vectors
class Complex {
    constructor(re, im) { this.re = re; this.im = im; }
    static fromPolar(r, theta) { return new Complex(r * Math.cos(theta), r * Math.sin(theta)); }
    static add(a, b) { return new Complex(a.re + b.re, a.im + b.im); }
    mag() { return Math.sqrt(this.re**2 + this.im**2); }
    phase() { return Math.atan2(this.im, this.re); } // Returns radians
}

const CONSTANTS = {
    c: 343, // Speed of sound (m/s)
    hListener: 1.6, // Ear height (m)
    fMin: 20,
    fMax: 200
};

// State
let state = {
    posX: 15,
    heightMain: 8,
    delaySubMs: 0,
    fc: 80
};

// DOM Elements
const els = {
    ctrlPos: document.getElementById('ctrl-pos'),
    ctrlHeight: document.getElementById('ctrl-height'),
    ctrlDelay: document.getElementById('ctrl-delay'),
    ctrlXover: document.getElementById('ctrl-xover'),
    valPos: document.getElementById('val-pos'),
    valHeight: document.getElementById('val-height'),
    valDelay: document.getElementById('val-delay'),
    valXover: document.getElementById('val-xover'),
    cvsSpace: document.getElementById('canvas-space'),
    cvsMag: document.getElementById('canvas-magnitude'),
    cvsPhase: document.getElementById('canvas-phase')
};

const ctxSpace = els.cvsSpace.getContext('2d');
const ctxMag = els.cvsMag.getContext('2d');
const ctxPhase = els.cvsPhase.getContext('2d');

// Initialize events and canvas sizes
function init() {
    ['Pos', 'Height', 'Delay', 'Xover'].forEach(key => {
        els[`ctrl${key}`].addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state[`${key === 'Pos' ? 'posX' : key === 'Height' ? 'heightMain' : key === 'Delay' ? 'delaySubMs' : 'fc'}`] = val;
            els[`val${key}`].innerText = val;
            updateSimulation();
        });
    });

    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();
}

function resizeCanvases() {
    [els.cvsSpace, els.cvsMag, els.cvsPhase].forEach(cvs => {
        cvs.width = cvs.clientWidth * window.devicePixelRatio;
        cvs.height = cvs.clientHeight * window.devicePixelRatio;
    });
    updateSimulation();
}

// DSP Calculation Core
function getAcousticData() {
    // 1. Calculate distances
    const dMain = Math.sqrt(Math.pow(state.posX, 2) + Math.pow(state.heightMain - CONSTANTS.hListener, 2));
    const dSub = Math.sqrt(Math.pow(state.posX, 2) + Math.pow(CONSTANTS.hListener, 2)); // Sub on ground (h=0)

    // 2. Calculate times (seconds)
    const tMain = dMain / CONSTANTS.c;
    const tSub = (dSub / CONSTANTS.c) + (state.delaySubMs / 1000);

    const dataPoints = 200;
    const data = [];

    for (let i = 0; i <= dataPoints; i++) {
        // Logarithmic frequency steps
        const logF = Math.log10(CONSTANTS.fMin) + (i / dataPoints) * (Math.log10(CONSTANTS.fMax) - Math.log10(CONSTANTS.fMin));
        const f = Math.pow(10, logF);
        
        // Linkwitz-Riley 4th Order Magnitude (Normalized)
        const w = f / state.fc;
        const magLP = 1 / (1 + Math.pow(w, 4));
        const magHP = Math.pow(w, 4) / (1 + Math.pow(w, 4));

        // Time delay phase shift (radians)
        const phaseMain = -2 * Math.PI * f * tMain;
        const phaseSub = -2 * Math.PI * f * tSub;

        // Complex Vectors
        const vMain = Complex.fromPolar(magHP, phaseMain);
        const vSub = Complex.fromPolar(magLP, phaseSub);
        const vSum = Complex.add(vMain, vSub);

        data.push({
            f: f,
            magMain: 20 * Math.log10(vMain.mag() + 1e-6),
            magSub: 20 * Math.log10(vSub.mag() + 1e-6),
            magSum: 20 * Math.log10(vSum.mag() + 1e-6),
            phaseMain: (vMain.phase() * 180 / Math.PI),
            phaseSub: (vSub.phase() * 180 / Math.PI),
            phaseSum: (vSum.phase() * 180 / Math.PI)
        });
    }

    return { dMain, dSub, tMain, tSub, data };
}

// Drawing Utilities
function clearCanvas(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2 * window.devicePixelRatio;
}

function mapLog(f, w) {
    return (Math.log10(f) - Math.log10(CONSTANTS.fMin)) / (Math.log10(CONSTANTS.fMax) - Math.log10(CONSTANTS.fMin)) * w;
}

function drawGrid(ctx, w, h, isPhase) {
    ctx.strokeStyle = '#2c2c35';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Y-Axis
    if (isPhase) {
        [0, h/2, h].forEach(y => { ctx.moveTo(0, y); ctx.lineTo(w, y); });
    } else {
        [0, h/4, h/2, 3*h/4, h].forEach(y => { ctx.moveTo(0, y); ctx.lineTo(w, y); });
    }

    // X-Axis (Logarithmic Octave Bands roughly)
    [20, 40, 80, 160, 200].forEach(f => {
        const x = mapLog(f, w);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.fillStyle = '#888896';
        ctx.font = `${10 * window.devicePixelRatio}px Inter`;
        ctx.fillText(`${f}Hz`, x + 5, h - 5);
    });
    ctx.stroke();
}

function drawLine(ctx, data, key, color, w, h, isPhase) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    
    let prevY = 0;
    data.forEach((d, i) => {
        const x = mapLog(d.f, w);
        let y;
        
        if (isPhase) {
            // Map -180..180 to h..0
            y = h - ((d[key] + 180) / 360) * h;
            // Phase wrap break
            if (i > 0 && Math.abs(y - prevY) > h/2) {
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
        } else {
            // Map -30dB..+6dB to h..0
            const maxDB = 6;
            const minDB = -30;
            let val = Math.max(minDB, Math.min(maxDB, d[key]));
            y = h - ((val - minDB) / (maxDB - minDB)) * h;
        }

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        
        prevY = y;
    });
    ctx.stroke();
}

function drawSpaceView(simData) {
    const w = els.cvsSpace.width;
    const h = els.cvsSpace.height;
    clearCanvas(ctxSpace, w, h);

    const padding = 30 * window.devicePixelRatio;
    const usableW = w - padding * 2;
    const usableH = h - padding * 2;

    const maxDist = 40;
    const maxHeight = 16;
    
    const mapX = x => padding + (x / maxDist) * usableW;
    const mapY = y => padding + usableH - (y / maxHeight) * usableH;

    // Draw Floor
    ctxSpace.strokeStyle = '#333';
    ctxSpace.beginPath();
    ctxSpace.moveTo(padding, mapY(0));
    ctxSpace.lineTo(w - padding, mapY(0));
    ctxSpace.stroke();

    // Draw Main
    const mainX = mapX(0);
    const mainY = mapY(state.heightMain);
    ctxSpace.fillStyle = '#ffeb3b';
    ctxSpace.beginPath();
    ctxSpace.arc(mainX, mainY, 6 * window.devicePixelRatio, 0, Math.PI * 2);
    ctxSpace.fill();

    // Draw Sub
    const subX = mapX(0);
    const subY = mapY(0);
    ctxSpace.fillStyle = '#00bcd4';
    ctxSpace.beginPath();
    ctxSpace.fillRect(subX - 6 * window.devicePixelRatio, subY - 12 * window.devicePixelRatio, 12 * window.devicePixelRatio, 12 * window.devicePixelRatio);

    // Draw Listener
    const listX = mapX(state.posX);
    const listY = mapY(CONSTANTS.hListener);
    ctxSpace.fillStyle = '#ff8c00';
    ctxSpace.beginPath();
    ctxSpace.arc(listX, listY, 5 * window.devicePixelRatio, 0, Math.PI * 2);
    ctxSpace.fill();

    // Draw Distance Lines
    ctxSpace.setLineDash([5, 5]);
    ctxSpace.lineWidth = 1 * window.devicePixelRatio;
    
    ctxSpace.strokeStyle = 'rgba(255, 235, 59, 0.5)';
    ctxSpace.beginPath(); ctxSpace.moveTo(mainX, mainY); ctxSpace.lineTo(listX, listY); ctxSpace.stroke();
    
    ctxSpace.strokeStyle = 'rgba(0, 188, 212, 0.5)';
    ctxSpace.beginPath(); ctxSpace.moveTo(subX, subY); ctxSpace.lineTo(listX, listY); ctxSpace.stroke();
    ctxSpace.setLineDash([]);

    // Text Overlay
    ctxSpace.fillStyle = '#e0e0e0';
    ctxSpace.font = `${11 * window.devicePixelRatio}px Inter`;
    ctxSpace.fillText(`Main ToF: ${(simData.tMain * 1000).toFixed(1)} ms`, w - 200 * window.devicePixelRatio, 30 * window.devicePixelRatio);
    ctxSpace.fillText(`Sub ToF: ${(simData.tSub * 1000).toFixed(1)} ms (inc. delay)`, w - 200 * window.devicePixelRatio, 50 * window.devicePixelRatio);
    ctxSpace.fillText(`ΔT: ${(Math.abs(simData.tMain - simData.tSub) * 1000).toFixed(1)} ms`, w - 200 * window.devicePixelRatio, 70 * window.devicePixelRatio);
}

function updateSimulation() {
    const simData = getAcousticData();
    
    drawSpaceView(simData);
    
    const wM = els.cvsMag.width; const hM = els.cvsMag.height;
    clearCanvas(ctxMag, wM, hM);
    drawGrid(ctxMag, wM, hM, false);
    drawLine(ctxMag, simData.data, 'magMain', 'rgba(255, 235, 59, 0.6)', wM, hM, false);
    drawLine(ctxMag, simData.data, 'magSub', 'rgba(0, 188, 212, 0.6)', wM, hM, false);
    drawLine(ctxMag, simData.data, 'magSum', '#ff8c00', wM, hM, false);

    const wP = els.cvsPhase.width; const hP = els.cvsPhase.height;
    clearCanvas(ctxPhase, wP, hP);
    drawGrid(ctxPhase, wP, hP, true);
    drawLine(ctxPhase, simData.data, 'phaseMain', 'rgba(255, 235, 59, 0.6)', wP, hP, true);
    drawLine(ctxPhase, simData.data, 'phaseSub', 'rgba(0, 188, 212, 0.6)', wP, hP, true);
    drawLine(ctxPhase, simData.data, 'phaseSum', '#ff8c00', wP, hP, true);
}

// Boot
window.onload = init;