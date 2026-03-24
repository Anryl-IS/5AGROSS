// Configuration
const BASE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=0&single=true&output=csv';

// State
let dashboardData = [];
let dates = [];
let charts = {};

// Init
document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.font.family = '"Inter", sans-serif';
    Chart.defaults.color = '#a1a1aa'; // zinc-400
    
    setupTabs();
    fetchData();

    const searchInput = document.getElementById('detailsSearch');
    if (searchInput) searchInput.addEventListener('input', handleSearch);
});

// Tab Nav
function setupTabs() {
    const tabs = document.querySelectorAll('[data-tab]');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset styles
            tabs.forEach(t => {
                t.classList.remove('text-white', 'bg-ambient-700/50');
                t.classList.add('text-zinc-400');
            });
            // Hide all contents
            contents.forEach(c => {
                c.classList.add('hidden');
                c.classList.remove('block', 'animate-fade-in-up');
            });

            // Activate current
            tab.classList.remove('text-zinc-400');
            tab.classList.add('text-white', 'bg-ambient-700/50');
            const target = document.getElementById(`tab-${tab.dataset.tab}`);
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('block', 'animate-fade-in-up');
            }
        });
    });
}

// Data Handling & Swarm Proxies
async function fetchData() {
    showLoader(true);
    updateStatus('Connecting...', false);

    const endpoints = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(BASE_CSV_URL)}`,
        `https://corsproxy.io/?${encodeURIComponent(BASE_CSV_URL)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(BASE_CSV_URL)}`
    ];
        // Helper to fetch and strictly validate
    const fetchWithValidation = async (url) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000); 
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error('Bad Status');
            
            const text = await res.text();
            if (!text.toUpperCase().includes('TELLER')) {
                throw new Error('Intercepted or invalid CSV payload');
            }
            return text; 
        } catch(e) {
            clearTimeout(timeoutId);
            throw e;
        }
    };

    try {
        const winningCSV = await Promise.any(endpoints.map(fetchWithValidation));
        processCSV(winningCSV);
        if (dashboardData.length === 0) throw new Error("Parsed data was empty.");
        
        updateDashboard();
        updateStatus('Systems Live', true);

    } catch (err) {
        console.warn('Fallback triggered', err);
        useFallbackData();
        updateDashboard();
        updateStatus('Offline Demo', false);
    } finally {
        showLoader(false);
    }
}

function updateStatus(msg, isLive) {
    const el = document.getElementById('last-updated');
    if(el) {
        el.innerText = `${msg}`;
        const ping = el.previousElementSibling.querySelector('.animate-ping');
        const dot = el.previousElementSibling.querySelector('.relative');
        if (isLive) {
            ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
            dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
        } else {
            ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75';
            dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]';
        }
    }
}

function processCSV(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    let currentSupervisor = '';
    let foundHeaders = false;
    let tempResults = [];

    lines.forEach((line) => {
        const cols = parseCSVLine(line);
        if (cols.length < 3) return;

        // Detect Supervisor Header mapping (cols[1] is now 'Teller')
        if (cols[0].trim() !== '' && cols[1] === 'Teller') {
            currentSupervisor = cols[0].split('-').join(' ').toUpperCase();
            if (!foundHeaders) {
                // Dates now start at index 3 instead of 9!
                dates = cols.slice(3).filter(d => d.trim() !== '');
                foundHeaders = true;
            }
            return;
        }

        // Detect data row mappings
        if (cols[0] === '' && cols[1] !== '' && cols[1] !== 'Teller' && cols[1].toUpperCase() !== 'TOTAL') {
            
            const dailySalesArr = cols.slice(3).map(v => parseFloat(v.replace(/,/g, '')) || 0);
            const sumTotal = dailySalesArr.reduce((sum, val) => sum + val, 0);

            const tellerData = {
                supervisor: currentSupervisor,
                teller: cols[1].trim(),
                address: cols[2].trim(),
                isActive: sumTotal > 0, // Explicitly infer status based on yield since 'IsActive' col was removed
                dailySales: dailySalesArr,
                total: sumTotal
            };
            tempResults.push(tellerData);
        }
    });

    dashboardData = tempResults;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current);
    return result;
}

function updateDashboard() {
    renderOverview();
    renderDetails(dashboardData);
    renderAreas();
    renderComparison();
}

function renderOverview() {
    const totalGross = dashboardData.reduce((s, t) => s + t.total, 0);
    const activeData = dashboardData.filter(t => t.isActive);
    const totalTellers = activeData.length;
    
    // Animate KPI
    animateNumber('total-gross', totalGross, true);
    document.getElementById('total-tellers').innerText = totalTellers;
    animateNumber('avg-daily', totalGross / (dates.length || 1), true);

    // Render Trend Chart
    const ctx = document.getElementById('trendChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.trend) charts.trend.destroy();

    const dailyTotals = dates.map((_, i) => dashboardData.reduce((sum, t) => sum + (t.dailySales[i] || 0), 0));
    
    const grad = ctx.createLinearGradient(0, 0, 0, 400);
    grad.addColorStop(0, 'rgba(234, 179, 8, 0.4)'); // Gold
    grad.addColorStop(1, 'rgba(234, 179, 8, 0)');

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Gross',
                data: dailyTotals,
                borderColor: '#eab308', // gold-500
                backgroundColor: grad,
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#18181b',
                pointBorderColor: '#eab308',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1,
                    titleFont: { size: 14 }, bodyFont: { size: 15, weight: 'bold' },
                    callbacks: { label: (ctx) => ` ₱${ctx.raw.toLocaleString()}` }
                }
            },
            scales: {
                x: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa' } },
                y: { grid: { color: '#27272a', borderDash: [5,5] }, ticks: { color: '#a1a1aa', callback: (v)=> '₱'+(v>=1000?v/1000+'k':v) } }
            }
        }
    });
}

function renderDetails(data) {
    const tbody = document.getElementById('detailed-breakdown-body');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-5 text-center text-zinc-500 italic">No exact matches found.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(t => `
        <tr class="hover:bg-ambient-800/40 transition-colors group">
            <td class="px-8 py-5 whitespace-nowrap">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg ${t.isActive ? 'bg-gold-500/10 text-gold-500' : 'bg-zinc-800 text-zinc-500'} flex items-center justify-center font-bold text-xs ring-1 ring-inset ${t.isActive ? 'ring-gold-500/30' : 'ring-zinc-700/50'}">
                        ${t.teller.charAt(0)}
                    </div>
                    <div>
                        <span class="block text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">${t.teller}</span>
                        <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">${t.supervisor}</span>
                    </div>
                </div>
            </td>
            <td class="px-8 py-5 whitespace-nowrap text-sm text-zinc-400 font-medium">
                <i class="fas fa-map-pin text-zinc-600 mr-2"></i>${t.address}
            </td>
            <td class="px-8 py-5 text-right font-black text-white whitespace-nowrap tabular-nums">
                <span class="text-zinc-500 mr-1.5 font-bold">₱</span>${t.total.toLocaleString()}
            </td>
            <td class="px-8 py-5 text-center whitespace-nowrap">
                <span class="inline-flex items-center justify-center px-3 py-1 rounded-md text-[10px] border font-bold uppercase tracking-widest ${t.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}">
                    ${t.isActive ? 'Active' : 'Offline'}
                </span>
            </td>
        </tr>
    `).join('');
}

function handleSearch(e) {
    const q = e.target.value.toLowerCase();
    const filtered = dashboardData.filter(t => 
        t.teller.toLowerCase().includes(q) || 
        t.address.toLowerCase().includes(q) ||
        t.supervisor.toLowerCase().includes(q)
    );
    renderDetails(filtered);
}

function renderAreas() {
    const grid = document.getElementById('areas-grid');
    if (!grid) return;

    if (dates.length < 2) {
        grid.innerHTML = '<p class="text-zinc-500 italic col-span-full">Insufficient chronological data for area comparison.</p>';
        return;
    }

    const mid = Math.floor(dates.length / 2);
    const areaStats = {};

    dashboardData.forEach(t => {
        if (!areaStats[t.supervisor]) {
            areaStats[t.supervisor] = { name: t.supervisor, prev: 0, curr: 0, activeTellers: 0 };
        }
        
        const sumPrev = t.dailySales.slice(0, mid).reduce((a, b) => a + b, 0);
        const sumCurr = t.dailySales.slice(mid, dates.length).reduce((a, b) => a + b, 0);
        
        areaStats[t.supervisor].prev += sumPrev;
        areaStats[t.supervisor].curr += sumCurr;
        if (t.isActive) areaStats[t.supervisor].activeTellers += 1;
    });

    const cardsHtml = Object.values(areaStats)
        .sort((a, b) => b.curr - a.curr)
        .map(area => {
            const diff = area.curr - area.prev;
            const pct = area.prev > 0 ? (diff / area.prev) * 100 : 0;
            const isUp = diff >= 0;

            return `
            <div class="glass-card p-6 rounded-3xl border border-zinc-800 flex flex-col relative overflow-hidden group hover:border-zinc-700 transition-all shadow-[0_8px_30px_-5px_rgba(0,0,0,0.5)]">
                <div class="absolute inset-0 bg-gradient-to-br from-zinc-800/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-ambient-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                            <i class="fas fa-layer-group"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-white uppercase tracking-widest">${area.name}</h3>
                            <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5"><i class="fas fa-user-tie mr-1"></i>${area.activeTellers} Active Tellers</p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 mt-2 relative z-10">
                    <div class="bg-ambient-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <span class="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 shadow-sm">Previous 7D</span>
                        <div class="flex items-baseline gap-1">
                            <span class="text-xs font-bold text-zinc-600">₱</span>
                            <span class="text-lg font-bold text-zinc-400 tracking-tight">${area.prev.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    <div class="bg-ambient-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <span class="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 shadow-sm">Current 7D</span>
                        <div class="flex items-baseline gap-1">
                            <span class="text-xs font-bold text-emerald-600">₱</span>
                            <span class="text-xl font-bold text-white tracking-tight">${area.curr.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>

                <div class="mt-4 flex items-center justify-between border-t border-zinc-800/50 pt-4 relative z-10">
                    <span class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Growth Shift</span>
                    <div class="text-right">
                        <span class="block text-sm ${isUp ? 'text-emerald-400' : 'text-red-400'} font-black tabular-nums">
                            ${isUp ? '+' : ''}₱${diff.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                        <span class="text-[10px] font-bold uppercase px-2 py-0.5 mt-1 inline-block rounded ${isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
                            ${isUp ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>'} ${Math.abs(pct).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>`;
        }).join('');

    grid.innerHTML = cardsHtml;
}

function renderComparison() {
    // 14 days split
    const days = dates.length;
    const mid = Math.floor(days / 2);
    
    // Ensure we have enough data (at least 2 days to compare)
    if (days < 2) return; 

    const prevDates = dates.slice(0, mid);
    const currDates = dates.slice(mid, days);
    
    let prevTotal = 0;
    let currTotal = 0;
    
    // Performance Shift per supervisor for Unit Performance Shift table
    let shiftData = {};

    dashboardData.forEach(t => {
        const pSum = t.dailySales.slice(0, mid).reduce((a,b)=>a+b, 0);
        const cSum = t.dailySales.slice(mid, days).reduce((a,b)=>a+b, 0);
        
        prevTotal += pSum;
        currTotal += cSum;

        if (!shiftData[t.supervisor]) {
            shiftData[t.supervisor] = { prev: 0, curr: 0, name: t.supervisor };
        }
        shiftData[t.supervisor].prev += pSum;
        shiftData[t.supervisor].curr += cSum;
    });

    animateNumber('current-week-total', currTotal, true);
    animateNumber('previous-week-total', prevTotal, true);

    const diffPct = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : 0;
    const badge = document.getElementById('comparison-badge');
    if(badge) {
        badge.innerText = `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%`;
        if (diffPct > 0) {
            badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        } else {
            badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30';
        }
    }

    // Chart
    const ctx = document.getElementById('comparisonChart')?.getContext('2d');
    if (ctx) {
        if (charts.comp) charts.comp.destroy();
        
        const prevDailySum = prevDates.map((_, i) => dashboardData.reduce((s, t) => s + (t.dailySales[i] || 0), 0));
        const currDailySum = currDates.map((_, i) => dashboardData.reduce((s, t) => s + (t.dailySales[mid + i] || 0), 0));

        // Create generic labels Day 1, Day 2 for grouping
        const dualLabels = prevDates.map((d, i) => `Day ${i+1}`);

        charts.comp = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dualLabels,
                datasets: [
                    {
                        label: 'Current Period',
                        data: currDailySum,
                        backgroundColor: '#eab308',
                        borderRadius: 4
                    },
                    {
                        label: 'Previous Period',
                        data: prevDailySum,
                        backgroundColor: '#27272a',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#a1a1aa' } },
                    tooltip: { backgroundColor: '#18181b', titleColor: '#fff', bodyColor: '#a1a1aa', callbacks: { label: (ctx)=> ' ₱'+ctx.raw.toLocaleString() } }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#27272a' }, ticks: { callback: (v)=> '₱'+(v>=1000?v/1000+'k':v) } }
                }
            }
        });
    }

    // Unit Shift
    const shiftList = document.getElementById('shift-list');
    if (shiftList) {
        const shifts = Object.values(shiftData)
            .map(s => {
                s.diff = s.curr - s.prev;
                s.pct = s.prev > 0 ? (s.diff / s.prev) * 100 : 0;
                return s;
            })
            .sort((a,b) => b.diff - a.diff);

        shiftList.innerHTML = shifts.map(s => `
            <div class="flex items-center justify-between p-4 mb-2 bg-ambient-800/50 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div>
                    <h4 class="text-white font-bold text-sm tracking-wide">${s.name}</h4>
                    <p class="text-xs text-zinc-500 font-medium mt-1">Previous: ₱${s.prev.toLocaleString()} → <span class="text-zinc-300">₱${s.curr.toLocaleString()}</span></p>
                </div>
                <div class="text-right">
                    <span class="block ${s.diff >= 0 ? 'text-emerald-400' : 'text-red-400'} font-black tabular-nums">
                        ${s.diff >= 0 ? '+' : ''}₱${s.diff.toLocaleString()}
                    </span>
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 mt-1 inline-block rounded ${s.pct >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
                        ${s.pct >= 0 ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>'} ${Math.abs(s.pct).toFixed(1)}%
                    </span>
                </div>
            </div>
        `).join('');
    }
}

function showLoader(show) {
    const el = document.getElementById('loader');
    if (!el) return;
    if (show) {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
    } else {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
    }
}

function animateNumber(id, end, isCurrency) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    const start = 0;
    const duration = 1200;
    let startTimestamp = null;
    const step = (ts) => {
        if (!startTimestamp) startTimestamp = ts;
        const progress = Math.min((ts - startTimestamp) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const val = Math.floor(ease * (end - start) + start);
        obj.innerText = isCurrency ? val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : val;
        
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerText = isCurrency ? end.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : end;
    };
    window.requestAnimationFrame(step);
}

// Fallback logic for offline
function useFallbackData() {
    dates = ['03-01-26', '03-02-26', '03-03-26', '03-04-26', '03-05-26', '03-06-26', '03-07-26', '03-08-26', '03-09-26', '03-10-26', '03-11-26', '03-12-26', '03-13-26', '03-14-26'];
    const pGen = (base) => Array.from({length: 14}, () => base + Math.floor(Math.random()*2000));
    dashboardData = [
        { supervisor: 'MONTAWAL SPVR POTS', teller: 'GLADYS JANE G SEBASTIAN', address: 'MONTAWAL POBLACION', isActive: true, dailySales: pGen(2000), total: 0 },
        { supervisor: 'AMPATUAN SPVR TEDDY', teller: 'JENNILYN TOMECUETO', address: 'AMPATUAN KAMASI', isActive: true, dailySales: pGen(5000), total: 0 },
        { supervisor: 'MONTAWAL SPVR POTS', teller: 'AMOR G. ABAN', address: 'DATU MONTAWAL-TUNGGOL', isActive: true, dailySales: pGen(7000), total: 0 }
    ];
    dashboardData.forEach(t => t.total = t.dailySales.reduce((a,b)=>a+b, 0));
}
