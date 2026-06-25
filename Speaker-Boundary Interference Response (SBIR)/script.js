document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    room: document.getElementById('room-canvas'),
    graph: document.getElementById('graph-canvas'),
    dist: document.getElementById('dist-slider'),
    treat: document.getElementById('treat-slider'),
    cut: document.getElementById('cut-slider'),
    realWorld: document.getElementById('real-world-toggle'),
    distVal: document.getElementById('dist-val'),
    treatVal: document.getElementById('treat-val'),
    cutVal: document.getElementById('cut-val'),
    nullDisp: document.getElementById('null-freq-display')
  };

  const roomCtx = elements.room.getContext('2d');
  const graphCtx = elements.graph.getContext('2d');

  // DSP Constants
  const C = 343; // Speed of sound
  const LISTENER_DIST = 1.5; // m (ระยะจากลำโพงถึงจุดนั่งฟังสมมติ)

  let state = {
    L: parseFloat(elements.dist.value),
    T: parseFloat(elements.treat.value),
    Fcut: parseFloat(elements.cut.value),
    realWorld: elements.realWorld.checked
  };

  function resize() {
    [elements.room, elements.graph].forEach(c => {
      c.width = c.clientWidth * window.devicePixelRatio;
      c.height = c.clientHeight * window.devicePixelRatio;
      c.getContext('2d').scale(window.devicePixelRatio, window.devicePixelRatio);
    });
    render();
  }

  // 1. Acoustic Material Non-linear reflection
  function getReflectionCoef(f, T) {
    const fc = 150;
    return 1.0 - (T * (Math.pow(f, 2) / (Math.pow(f, 2) + Math.pow(fc, 2))));
  }

  // 2. Speaker Roll-off (24dB/octave High Pass)
  function getSpeakerResponseDB(f, Fcut) {
    const linear = 1 / Math.sqrt(1 + Math.pow(Fcut / f, 8));
    return 10 * Math.log10(Math.max(linear * linear, 0.00001));
  }

  // 3. Main DSP Calculation
  function calculateSBIRCurve(L, T, Fcut, applyPhysics) {
    const curve = [];
    const minF = 20, maxF = 1000;
    const points = 500;
    
    // ระยะเดินทางของเสียง
    const dDirect = LISTENER_DIST;
    const dReflect = LISTENER_DIST + (2 * L);
    // Inverse Square Law (Loss factor)
    const distanceLossFactor = applyPhysics ? (dDirect / dReflect) : 1.0;

    for (let i = 0; i <= points; i++) {
      const f = minF * Math.pow(maxF / minF, i / points);
      
      // Calculate Ideal Reflection with or without Energy Loss
      const R_ideal = getReflectionCoef(f, T);
      const R_effective = R_ideal * distanceLossFactor;

      const phase = (4 * Math.PI * f * L) / C;
      const magSq = 1 + (R_effective * R_effective) + (2 * R_effective * Math.cos(phase));
      
      let db = 10 * Math.log10(Math.max(magSq, 0.0001));
      
      // Apply speaker low cut
      db += getSpeakerResponseDB(f, Fcut);
      
      curve.push({ f, db });
    }

    // Apply 1/6 Octave Smoothing if RealWorld mode is on
    if (applyPhysics) {
      const smoothed = [];
      for (let i = 0; i < curve.length; i++) {
        const f = curve[i].f;
        const fLow = f * Math.pow(2, -1/12);
        const fHigh = f * Math.pow(2, 1/12);
        
        let sumPower = 0; let count = 0;
        for (let j = 0; j < curve.length; j++) {
          if (curve[j].f >= fLow && curve[j].f <= fHigh) {
            sumPower += Math.pow(10, curve[j].db / 10);
            count++;
          }
        }
        smoothed.push({ f, db: 10 * Math.log10(sumPower / count) });
      }
      return smoothed;
    }

    return curve;
  }

  function drawRoom() {
    const w = elements.room.clientWidth;
    const h = elements.room.clientHeight;
    roomCtx.clearRect(0, 0, w, h);

    // Floor grid
    roomCtx.strokeStyle = '#121214'; roomCtx.lineWidth = 1;
    for(let i=0; i<w; i+=20) { roomCtx.beginPath(); roomCtx.moveTo(i, 0); roomCtx.lineTo(i, h); roomCtx.stroke(); }

    const wallX = 40;
    // Wall
    roomCtx.fillStyle = '#1f1f22'; roomCtx.fillRect(0, 0, wallX, h);
    
    // Treatment
    if (state.T > 0) {
      const pW = 5 + (state.T * 20);
      roomCtx.fillStyle = `rgba(255, 107, 0, ${0.2 + state.T*0.3})`;
      roomCtx.fillRect(wallX, 0, pW, h);
    }

    const pxPerM = (w - wallX - 60) / 3.0;
    const spkX = wallX + (state.L * pxPerM);
    const spkY = h / 2;

    // Direct / Reflect Lines
    roomCtx.strokeStyle = 'rgba(255, 107, 0, 0.4)';
    roomCtx.setLineDash([4, 4]);
    roomCtx.beginPath();
    roomCtx.moveTo(spkX, spkY); 
    roomCtx.lineTo(wallX + (state.T > 0 ? 5 + state.T*20 : 0), spkY - 15);
    roomCtx.lineTo(spkX + 50, spkY - 40);
    roomCtx.stroke(); roomCtx.setLineDash([]);

    // Speaker Box
    roomCtx.fillStyle = '#000000'; roomCtx.strokeStyle = '#e4e4e7'; roomCtx.lineWidth = 2;
    roomCtx.fillRect(spkX - 15, spkY - 20, 30, 40); roomCtx.strokeRect(spkX - 15, spkY - 20, 30, 40);
    roomCtx.beginPath(); roomCtx.arc(spkX + 5, spkY, 10, 0, Math.PI*2);
    roomCtx.fillStyle = '#27272a'; roomCtx.fill(); roomCtx.stroke();

    // Measurement Line
    roomCtx.strokeStyle = '#a1a1aa'; roomCtx.fillStyle = '#a1a1aa';
    roomCtx.beginPath(); roomCtx.moveTo(wallX, spkY + 40); roomCtx.lineTo(spkX, spkY + 40); roomCtx.stroke();
    roomCtx.beginPath(); roomCtx.moveTo(wallX, spkY + 35); roomCtx.lineTo(wallX, spkY + 45); roomCtx.stroke();
    roomCtx.beginPath(); roomCtx.moveTo(spkX, spkY + 35); roomCtx.lineTo(spkX, spkY + 45); roomCtx.stroke();
    
    roomCtx.font = '12px JetBrains Mono'; roomCtx.textAlign = 'center';
    roomCtx.fillText(`${state.L.toFixed(2)} m`, wallX + (spkX - wallX)/2, spkY + 55);
  }

  function drawGraph() {
    const w = elements.graph.clientWidth;
    const h = elements.graph.clientHeight;
    graphCtx.clearRect(0, 0, w, h);

    const minDB = -36, maxDB = 6, rangeDB = maxDB - minDB;
    const minF = 20, maxF = 1000;
    const logMin = Math.log10(minF), logMax = Math.log10(maxF);

    const getX = f => ((Math.log10(f) - logMin) / (logMax - logMin)) * w;
    const getY = db => h - (((Math.max(minDB, Math.min(maxDB, db)) - minDB) / rangeDB) * h);

    // Draw Grid
    graphCtx.strokeStyle = '#1f1f22'; graphCtx.fillStyle = '#52525b';
    graphCtx.font = '10px JetBrains Mono';
    
    [20, 50, 100, 200, 500, 1000].forEach(f => {
      const x = getX(f);
      graphCtx.beginPath(); graphCtx.moveTo(x, 0); graphCtx.lineTo(x, h); graphCtx.stroke();
      graphCtx.textAlign = 'center'; graphCtx.fillText(`${f}Hz`, x, h - 5);
    });

    [-30, -20, -10, 0].forEach(db => {
      const y = getY(db);
      graphCtx.beginPath(); graphCtx.moveTo(0, y); graphCtx.lineTo(w, y); 
      graphCtx.strokeStyle = db === 0 ? '#3f3f46' : '#1f1f22'; graphCtx.stroke();
      graphCtx.textAlign = 'left'; graphCtx.fillText(`${db}dB`, 5, y - 5);
    });

    // Draw Ideal Curve (Background)
    const curveIdeal = calculateSBIRCurve(state.L, state.T, state.Fcut, false);
    graphCtx.beginPath();
    graphCtx.strokeStyle = state.realWorld ? '#52525b' : '#ff6b00';
    graphCtx.lineWidth = state.realWorld ? 1.5 : 2.5;
    if(state.realWorld) graphCtx.setLineDash([4, 4]);
    
    curveIdeal.forEach((pt, i) => i === 0 ? graphCtx.moveTo(getX(pt.f), getY(pt.db)) : graphCtx.lineTo(getX(pt.f), getY(pt.db)));
    graphCtx.stroke(); graphCtx.setLineDash([]);

    // Draw Real-World Curve (Foreground)
    if (state.realWorld) {
      const curveReal = calculateSBIRCurve(state.L, state.T, state.Fcut, true);
      graphCtx.beginPath();
      graphCtx.strokeStyle = '#ff6b00';
      graphCtx.lineWidth = 3;
      curveReal.forEach((pt, i) => i === 0 ? graphCtx.moveTo(getX(pt.f), getY(pt.db)) : graphCtx.lineTo(getX(pt.f), getY(pt.db)));
      graphCtx.stroke();
    }
  }

  function render() {
    drawRoom();
    drawGraph();
    const nullFreq = C / (4 * state.L);
    elements.nullDisp.innerText = `Primary Null: ${nullFreq.toFixed(1)} Hz`;
  }

  // Listeners
  elements.dist.addEventListener('input', e => { state.L = parseFloat(e.target.value); elements.distVal.innerText = `${state.L.toFixed(2)} m`; render(); });
  elements.treat.addEventListener('input', e => { state.T = parseFloat(e.target.value); elements.treatVal.innerText = `${Math.round(state.T * 100)}%`; render(); });
  elements.cut.addEventListener('input', e => { state.Fcut = parseFloat(e.target.value); elements.cutVal.innerText = `${state.Fcut} Hz`; render(); });
  elements.realWorld.addEventListener('change', e => { state.realWorld = e.target.checked; render(); });
  window.addEventListener('resize', resize);

  resize();
});