document.addEventListener("DOMContentLoaded", () => {
    const fInput = document.getElementById('freq');
    const dInput = document.getElementById('dist');
    const fDisp = document.getElementById('freq-disp');
    const dDisp = document.getElementById('dist-disp');
    const waveDisp = document.getElementById('wavelength');
    const critDisp = document.getElementById('crit-dist');
    const statusDisp = document.getElementById('status');
    const gainDisp = document.getElementById('gain');
    const canvas = document.getElementById('radiation-map');
    const ctx = canvas.getContext('2d');

    const C_SPEED_OF_SOUND = 343; // meters per second

    function updateDSP() {
        const freq = parseFloat(fInput.value);
        const dist = parseFloat(dInput.value);

        // Update UI
        fDisp.textContent = `${freq} Hz`;
        dDisp.textContent = `${dist.toFixed(2)} m`;

        // Physics Calculation
        const lambda = C_SPEED_OF_SOUND / freq;
        const lambdaQuarter = lambda / 4;
        const lambdaHalf = lambda / 2;

        waveDisp.textContent = `${lambda.toFixed(2)} m`;
        critDisp.textContent = `${lambdaQuarter.toFixed(2)} m`;

        // Status & Gain Logic
        if (dist <= lambdaQuarter) {
            statusDisp.textContent = 'PERFECT COUPLING';
            statusDisp.style.color = 'var(--color-success)';
            gainDisp.textContent = '+6.0 dB';
            gainDisp.style.color = 'var(--color-success)';
        } else if (dist < lambdaHalf) {
            statusDisp.textContent = 'PARTIAL (WIDENING)';
            statusDisp.style.color = 'var(--accent-color)';
            
            // Interpolate from +6 to +3 dB
            const ratio = (dist - lambdaQuarter) / (lambdaHalf - lambdaQuarter);
            const gain = 6.0 - (3.0 * ratio);
            gainDisp.textContent = `+${gain.toFixed(1)} dB`;
            gainDisp.style.color = 'var(--accent-color)';
        } else {
            statusDisp.textContent = 'COMB FILTERING / LOBING';
            statusDisp.style.color = 'var(--color-danger)';
            gainDisp.textContent = '+3.0 dB (Power Sum)';
            gainDisp.style.color = 'var(--color-danger)';
        }

        renderRadiationMap(freq, dist, lambda);
    }

    function renderRadiationMap(freq, dist, lambda) {
        const width = canvas.width;
        const height = canvas.height;
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        // Scale: Let's assume the canvas width represents 6 meters real world space
        const pxPerMeter = width / 6; 
        
        // Speakers position (Bottom Center)
        const cx1 = width / 2 - (dist * pxPerMeter) / 2;
        const cx2 = width / 2 + (dist * pxPerMeter) / 2;
        const cy = height * 0.9;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Distance to each speaker
                const d1 = Math.sqrt(Math.pow(x - cx1, 2) + Math.pow(y - cy, 2)) / pxPerMeter;
                const d2 = Math.sqrt(Math.pow(x - cx2, 2) + Math.pow(y - cy, 2)) / pxPerMeter;

                // Phase difference calculation
                const deltaDist = Math.abs(d1 - d2);
                const deltaPhase = (2 * Math.PI * deltaDist) / lambda;

                // Intensity calculation for interference pattern: cos^2(deltaPhase / 2)
                const interference = Math.pow(Math.cos(deltaPhase / 2), 2);

                // Inverse square law attenuation (simplified for visualization)
                const avgDist = (d1 + d2) / 2;
                const attenuation = Math.min(1, 1 / (avgDist + 0.5));

                const finalLevel = interference * attenuation;

                // Color Mapping (Dark Grey to Pro Audio Orange)
                const idx = (y * width + x) * 4;
                data[idx] = 20 + (243 - 20) * finalLevel;     // R
                data[idx + 1] = 20 + (156 - 20) * finalLevel; // G
                data[idx + 2] = 20 + (18 - 20) * finalLevel;  // B
                data[idx + 3] = 255;                          // Alpha
            }
        }
        
        ctx.putImageData(imgData, 0, 0);

        // Draw Speaker Indicators
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx1, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(cx2, cy, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Event Listeners
    fInput.addEventListener('input', updateDSP);
    dInput.addEventListener('input', updateDSP);

    // Initial Trigger
    updateDSP();
});