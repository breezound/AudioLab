//จับคู่ DOM Elements จาก HTML
const sampleRateSelect = document.getElementById('sampleRate');
const bufferSizeSelect = document.getElementById('bufferSize');
const networkHopsSlider = document.getElementById('networkHops');
const hopsDisplay = document.getElementById('hopsDisplay');

const totalRtlValue = document.getElementById('totalRtlValue');
const latencyStatus = document.getElementById('latencyStatus');

const barBuffer = document.getElementById('barBuffer');
const barNetwork = document.getElementById('barNetwork');
const barAdda = document.getElementById('barAdda');

const txtBuffer = document.getElementById('txtBuffer');
const txtNetwork = document.getElementById('txtNetwork');
const txtAdda = document.getElementById('txtAdda');

// ฟังก์ชันหลักในการคำนวณ Latency
function updateRtlSimulation() {
    // 1. รับค่าจาก Inputs
    const sampleRate = parseInt(sampleRateSelect.value);
    const bufferSize = parseInt(bufferSizeSelect.value);
    const hops = parseInt(networkHopsSlider.value);

    // อัปเดตข้อความ Badge ของตัวสไลด์เครือข่าย
    hopsDisplay.textContent = `${hops} Hop${hops > 1 ? 's' : ''}`;

    // 2. คำนวณค่าแยกส่วนตาม Logic ตัวแปรควบคุม
    // Buffer Latency (ms) = (Buffer / Sample Rate) * 2000
    const bufferLatency = (bufferSize / sampleRate) * 2000;
    
    // Network Latency (ms) = Hops * 0.25
    const networkLatency = hops * 0.25;
    
    // AD/DA Latency คงที่ที่ 1 ms
    const addaLatency = 1.0;

    // ความหน่วงรวมทั้งหมด
    const totalRTL = bufferLatency + networkLatency + addaLatency;

    // 3. แสดงผลตัวเลขดิจิทัล
    totalRtlValue.textContent = totalRTL.toFixed(2);
    txtBuffer.textContent = `${bufferLatency.toFixed(2)} ms`;
    txtNetwork.textContent = `${networkLatency.toFixed(2)} ms`;
    txtAdda.textContent = `${addaLatency.toFixed(2)} ms`;

    // 4. คำนวณเปอร์เซ็นต์สัดส่วนเพื่อวาด Bar Chart
    const bufferPercent = (bufferLatency / totalRTL) * 100;
    const networkPercent = (networkLatency / totalRTL) * 100;
    const addaPercent = (addaLatency / totalRTL) * 100;

    barBuffer.style.width = `${bufferPercent}%`;
    barNetwork.style.width = `${networkPercent}%`;
    barAdda.style.width = `${addaPercent}%`;

    // 5. วิเคราะห์และอัปเดตสถานะความหน่วงสำหรับงานมอนิเตอร์เสียง
    if (totalRTL <= 3.5) {
        latencyStatus.textContent = "สถานะ: ความหน่วงต่ำเป็นพิเศษ (Ultra-low) เหมาะกับการ Live Monitor ที่สุด";
        latencyStatus.style.color = "#34d399"; // สีเขียวสว่าง
    } else if (totalRTL <= 10.0) {
        latencyStatus.textContent = "สถานะ: ความหน่วงอยู่ในเกณฑ์ดี (Optimal) นักดนตรีทั่วไปไม่สามารถสังเกตเห็นได้";
        latencyStatus.style.color = "#60a5fa"; // สีฟ้า
    } else if (totalRTL <= 15.0) {
        latencyStatus.textContent = "สถานะ: ปานกลาง (Acceptable) งานแสดงสดอาจรู้สึกตื้อเล็กน้อย แต่ยอมรับได้";
        latencyStatus.style.color = "#fbbf24"; // สีส้ม/เหลือง
    } else {
        latencyStatus.textContent = "สถานะ: หน่วงเกินเกณฑ์ (Latency Warning) ไม่แนะนำสำหรับการบันทึกเสียงสด";
        latencyStatus.style.color = "#f87171"; // สีแดง
    }
}

// ผูกฟังก์ชันเข้ากับ Event Listener ของทุก Controller
sampleRateSelect.addEventListener('change', updateRtlSimulation);
bufferSizeSelect.addEventListener('change', updateRtlSimulation);
networkHopsSlider.addEventListener('input', updateRtlSimulation);

// สั่งให้คำนวณและแสดงผลครั้งแรกทันทีเมื่อโหลดหน้าเว็บสำเร็จ
updateRtlSimulation();