document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById('rta-canvas');
    const ctx = canvas.getContext('2d');
    
    // UI Elements
    const delaySlider = document.getElementById('delay-slider');
    const delayVal = document.getElementById('delay-val');
    const distVal = document.getElementById('dist-val');
    const nullReadout = document.getElementById('null-readout');

    // DSP State
    let delayMs = parseFloat(delaySlider.value);
    const soundSpeed = 343; // m/s

    // Canvas Settings
    let width, height;
    const minFreq = 20;
    const maxFreq = 20000;
    const minDb = -30;
    const maxDb = 6;

    function resizeCanvas() {
        width = canvas.parentElement.clientWidth - 32; 
        height = 300;
        canvas.width = width;
        canvas.height = height;
        drawGraph();
    }
    window.addEventListener('resize', resizeCanvas);

    // Event Listener
    delaySlider.addEventListener('input', (e) => {
        delayMs = parseFloat(e.target.value);
        delayVal.textContent = delayMs.toFixed(1);
        distVal.textContent = ((delayMs / 1000) * soundSpeed * 100).toFixed(1);
        updateReadouts();
        drawGraph();
    });

    function mapFreqToX(f) {
        const minLog = Math.log10(minFreq);
        const maxLog = Math.log10(maxFreq);
        return ((Math.log10(f) - minLog) / (maxLog - minLog)) * width;
    }

    function mapDbToY(db) {
        return height - ((db - minDb) / (maxDb - minDb)) * height;
    }

    function updateReadouts() {
        if (delayMs > 0) {
            const firstNullFreq = 1000 / (2 * delayMs);
            nullReadout.textContent = `${Math.round(firstNullFreq)} Hz`;
        } else {
            nullReadout.textContent = `N/A (In-Phase)`;
        }
    }

    function drawGraph() {
        ctx.clearRect(0, 0, width, height);

        // Draw Grid Lines (Log X, Linear Y)
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';

        const gridFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        gridFreqs.forEach(f => {
            const x = mapFreqToX(f);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            if (f === 100 || f === 1000 || f === 10000) {
                let label = f >= 1000 ? `${f/1000}k` : f;
                ctx.fillText(label, x, height - 5);
            }
        });

        ctx.textAlign = 'left';
        for (let db = minDb; db <= maxDb; db += 6) {
            const y = mapDbToY(db);
            ctx.strokeStyle = db === 0 ? '#444' : '#222';
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            if (db !== minDb) {
                ctx.fillText(`${db > 0 ? '+' : ''}${db} dB`, 5, y - 4);
            }
        }

        // Draw Comb Filter Curve
        ctx.beginPath();
        ctx.strokeStyle = '#00E5FF'; // Cyan
        ctx.lineWidth = 2.5;

        const delaySec = delayMs / 1000;

        for (let x = 0; x <= width; x++) {
            const logRatio = x / width;
            const currentFreq = Math.pow(10, Math.log10(minFreq) + logRatio * (Math.log10(maxFreq) - Math.log10(minFreq)));
            
            // Phase Summation: sqrt(1^2 + 1^2 + 2(1)(1)cos(2*pi*f*t))
            const cosTerm = Math.cos(2 * Math.PI * currentFreq * delaySec);
            const linearSum = Math.sqrt(2 + 2 * cosTerm);
            
            // Convert to dB (avoiding log10(0) by capping at -30dB visually)
            let dbSum = 20 * Math.log10(Math.max(linearSum, 0.0316)); // 0.0316 is approx -30dB
            if (dbSum < minDb) dbSum = minDb;

            const y = mapDbToY(dbSum);

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Initialize
    resizeCanvas();
    updateReadouts();
});