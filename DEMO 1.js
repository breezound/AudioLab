// Get DOM Elements
const spl1Slider = document.getElementById('spl1Slider');
const distanceSlider = document.getElementById('distanceSlider');
const spl1Value = document.getElementById('spl1Value');
const distanceValue = document.getElementById('distanceValue');
const resultSPL = document.getElementById('resultSPL');
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

// Constants for Graph
const PADDING = 50;
const MAX_DISTANCE = 100;
const MIN_DISTANCE = 1;
const MAX_SPL = 140; // Max Y value
const MIN_SPL = 50;  // Min Y value (90 - 20*log10(100) = 50)

// Core Calculation Function
function calculateSPL2(spl1, distance) {
    return spl1 - 20 * Math.log10(distance);
}

// Map real values to Canvas coordinates
function getX(distance) {
    const width = canvas.width - PADDING * 2;
    return PADDING + ((distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * width;
}

function getY(spl) {
    const height = canvas.height - PADDING * 2;
    return canvas.height - PADDING - ((spl - MIN_SPL) / (MAX_SPL - MIN_SPL)) * height;
}

// Draw the entire visualization
function drawSimulation() {
    const spl1 = parseFloat(spl1Slider.value);
    const distance = parseFloat(distanceSlider.value);
    const spl2 = calculateSPL2(spl1, distance);

    // 1. Update UI Texts
    spl1Value.textContent = spl1;
    distanceValue.textContent = distance;
    resultSPL.textContent = spl2.toFixed(1);

    // 2. Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 3. Draw Grid & Axes
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // X Axis
    ctx.moveTo(PADDING, canvas.height - PADDING);
    ctx.lineTo(canvas.width - PADDING, canvas.height - PADDING);
    // Y Axis
    ctx.moveTo(PADDING, PADDING);
    ctx.lineTo(PADDING, canvas.height - PADDING);
    ctx.stroke();

    // 4. Draw Axis Labels
    ctx.fillStyle = '#aaa';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Distance (m)', canvas.width / 2, canvas.height - PADDING + 40);
    
    ctx.save();
    ctx.translate(PADDING - 35, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('SPL (dB)', 0, 0);
    ctx.restore();

    // 5. Plot the Inverse Square Law Curve
    ctx.strokeStyle = '#4dabf7'; // Blue line
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let d = MIN_DISTANCE; d <= MAX_DISTANCE; d++) {
        let currentSPL = calculateSPL2(spl1, d);
        if (d === MIN_DISTANCE) {
            ctx.moveTo(getX(d), getY(currentSPL));
        } else {
            ctx.lineTo(getX(d), getY(currentSPL));
        }
    }
    ctx.stroke();

    // 6. Draw the Listener Position Marker
    const markerX = getX(distance);
    const markerY = getY(spl2);

    // Dotted guiding lines
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(markerX, canvas.height - PADDING); // Line to X axis
    ctx.lineTo(markerX, markerY);
    ctx.lineTo(PADDING, markerY); // Line to Y axis
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Red Dot
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(markerX, markerY, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Label for the dot
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${spl2.toFixed(1)} dB`, markerX + 10, markerY - 10);
}

// Event Listeners for interactive updates
spl1Slider.addEventListener('input', drawSimulation);
distanceSlider.addEventListener('input', drawSimulation);

// Initial Draw on load
drawSimulation();