// ===== Helpers =====
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// Format ISO date string into Thai format: "22 พ.ค. 69 (08.50 น.)" — always Asia/Bangkok
function formatThaiDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const fmt = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric', month: 'short', year: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
    return `${parts.day} ${parts.month} ${parts.year} (${parts.hour}.${parts.minute} น.)`;
}

// Determine badge color from average score
function getBadgeColor(score) {
    if (score >= 4) return 'green';
    if (score >= 3) return 'yellow';
    return 'red';
}

// Render filled/empty stars based on average value
function renderStars(value) {
    const filled = Math.round(value);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += i <= filled 
            ? '<span>★</span>' 
            : '<span class="empty">★</span>';
    }
    return html;
}

// Basic HTML escape for safety
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ===== Color map for improvement progress bars =====
const IMPROVEMENT_COLORS = {
    'ไม่มีสิ่งที่ควรปรับปรุง':            '#16A34A',
    'การให้บริการหลังการขาย':             '#F97316',
    'ราคาสินค้า':                          '#EAB308',
    'ความรวดเร็วในการประสานงานขาย':       '#2563EB',
    'คุณภาพสินค้า':                        '#374151',
    'การประชาสัมพันธ์':                    '#EC4899',
    'อื่น ๆ':                              '#A855F7'
};

// ===== Main Render =====
async function loadDashboard() {
    try {
        const res = await fetch('/api/reports/summary');
        if (!res.ok) throw new Error('Auth failed or server error');
        const data = await res.json();

        // 1. Top stats cards
        document.getElementById('qrCreated').textContent = data.totals.qr_created;
        document.getElementById('surveyCompleted').textContent = data.totals.survey_completed;
        document.getElementById('responseRate').textContent = data.totals.response_rate;
        document.getElementById('avgScore').textContent = data.totals.avg_score.toFixed(1);

        // Render overall tooltip distribution
        const distOverallDiv = document.getElementById('distOverall');
        if (distOverallDiv && data.totals.overall_distribution) {
            const overallDist = data.totals.overall_distribution;
            const overallTotal = data.totals.overall_total_scores || 0;
            if (overallTotal === 0) {
                distOverallDiv.innerHTML = '<div style="text-align:center;font-size:11px;color:#6B7280;">ไม่มีข้อมูล</div>';
            } else {
                let distHtml = '';
                [5, 4, 3, 2, 1].forEach(star => {
                    const count = overallDist[star] || 0;
                    const pct = overallTotal > 0 ? (count / overallTotal) * 100 : 0;
                    distHtml += `
                        <div class="q-tooltip-row">
                            <div class="q-tooltip-star">${star} ดาว</div>
                            <div class="q-tooltip-bar-bg">
                                <div class="q-tooltip-bar-fill" style="width: ${pct}%"></div>
                            </div>
                            <div class="q-tooltip-count">${count} คน</div>
                        </div>
                    `;
                });
                distOverallDiv.innerHTML = distHtml;
            }
        }

        // 2. Per-employee table
        renderEmployeeTable(data.by_employee);

        // 3. Pending customers table
        renderPendingTable(data.pending_customers);

        // 4. Per-question average cards
        ['q1','q2','q3','q4'].forEach((q, i) => {
            const num = i + 1;
            // Support both old API (number) and new API (object)
            const rawItem = data.avg_per_question[q];
            const item = typeof rawItem === 'number' 
                ? { avg: rawItem, distribution: {5:0,4:0,3:0,2:0,1:0}, total: 0 }
                : (rawItem || { avg: 0, distribution: {5:0,4:0,3:0,2:0,1:0}, total: 0 });

            document.getElementById(`avgQ${num}`).textContent = item.avg.toFixed(1);
            document.getElementById(`starsQ${num}`).innerHTML = renderStars(item.avg);
            
            // Render tooltip distribution
            const distDiv = document.getElementById(`distQ${num}`);
            if (distDiv) {
                if (item.total === 0) {
                    distDiv.innerHTML = '<div style="text-align:center;font-size:11px;color:#6B7280;">ไม่มีข้อมูล</div>';
                } else {
                    let distHtml = '';
                    [5, 4, 3, 2, 1].forEach(star => {
                        const count = item.distribution[star] || 0;
                        const pct = item.total > 0 ? (count / item.total) * 100 : 0;
                        distHtml += `
                            <div class="q-tooltip-row">
                                <div class="q-tooltip-star">${star} ดาว</div>
                                <div class="q-tooltip-bar-bg">
                                    <div class="q-tooltip-bar-fill" style="width: ${pct}%"></div>
                                </div>
                                <div class="q-tooltip-count">${count} คน</div>
                            </div>
                        `;
                    });
                    distDiv.innerHTML = distHtml;
                }
            }
        });

        // 5. Progress bars
        renderProgressBars(data.improvement_breakdown);

        // 6. Feedback cards
        renderFeedbackCards(data.recent_feedback);

    } catch (err) {
        console.error('Dashboard load failed:', err);
        document.querySelectorAll('.loading').forEach(el => {
            el.textContent = 'โหลดข้อมูลไม่สำเร็จ — ลองรีโหลดหน้านี้';
        });
    }
}

function renderEmployeeTable(employees) {
    const tbody = document.getElementById('employeeTableBody');
    if (!employees.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">ยังไม่มีข้อมูล</td></tr>';
        return;
    }
    tbody.innerHTML = employees.map(e => `
        <tr>
            <td>${escapeHtml(e.employee_id)}</td>
            <td>${escapeHtml(e.employee_name)}</td>
            <td>${e.count}</td>
            <td><span class="score-badge ${getBadgeColor(e.avg_score)}">${e.avg_score.toFixed(1)}</span></td>
        </tr>
    `).join('');
}

function renderPendingTable(pending) {
    const tbody = document.getElementById('pendingTableBody');
    if (!pending.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">ไม่มีลูกค้าค้าง</td></tr>';
        return;
    }
    tbody.innerHTML = pending.map(p => `
        <tr>
            <td>${formatThaiDate(p.scan_time)}</td>
            <td>${escapeHtml(p.customer_name)}</td>
            <td>${escapeHtml(p.project_name)}</td>
            <td>${escapeHtml(p.employee_name)}</td>
            <td><span class="status-badge ${p.status === 'ยังไม่ได้สแกน' ? 'pending' : 'scanned'}">${p.status}</span></td>
        </tr>
    `).join('');
}

function renderProgressBars(items) {
    const container = document.getElementById('improvementBars');
    if (!items.length || items.every(i => i.count === 0)) {
        container.innerHTML = '<div class="loading">ยังไม่มีข้อมูล</div>';
        return;
    }
    container.innerHTML = items.map(item => {
        const color = IMPROVEMENT_COLORS[item.label] || '#9CA3AF';
        return `
            <div class="bar-row">
                <span class="bar-label">${escapeHtml(item.label)}</span>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${item.percent}%; background: ${color};"></div>
                </div>
                <span class="bar-percent">${item.percent.toFixed(0)}%</span>
            </div>
        `;
    }).join('');
}

function renderFeedbackCards(feedback) {
    const container = document.getElementById('feedbackList');
    if (!feedback.length) {
        container.innerHTML = '<div class="loading">ยังไม่มีข้อเสนอแนะ</div>';
        return;
    }
    container.innerHTML = feedback.map(f => `
        <div class="feedback-card">
            <div class="feedback-customer">${escapeHtml(f.customer_name)}</div>
            <div class="feedback-date">${formatThaiDate(f.submitted_at)}</div>
            <div class="feedback-text">${escapeHtml(f.text)}</div>
        </div>
    `).join('');
}

// ===== Auto-refresh every 60 seconds =====
loadDashboard();
setInterval(loadDashboard, 60000);
