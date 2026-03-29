const BASE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=0&single=true&output=csv';
const FEB_P1_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=811706992&single=true&output=csv';
const FEB_P2_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=130106578&single=true&output=csv';
const MAR_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=1232459230&single=true&output=csv';
// State
let dashboardData = [];
let dates = [];
let charts = {};
let syncTableData = [];

// Init
document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.font.family = '"Inter", sans-serif';
    Chart.defaults.color = '#a1a1aa'; // zinc-400

    setupTabs();
    fetchData();

    const searchInput = document.getElementById('detailsSearch');
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    const syncSearchInput = document.getElementById('syncSearch');
    if (syncSearchInput) syncSearchInput.addEventListener('input', handleSyncSearch);
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

            if (tab.dataset.tab === 'sync') {
                fetchSyncData();
            }
        });
    });
}

// Data Handling & Swarm Proxies
async function fetchData() {
    showLoader(true);
    updateStatus('Connecting...', false);

    const __cb = new Date().getTime();
    const __bustedUrl = `${BASE_CSV_URL}&__cb=${__cb}`;
    const endpoints = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(__bustedUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(__bustedUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(__bustedUrl)}`
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
        } catch (e) {
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
    if (el) {
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
                y: { grid: { color: '#27272a', borderDash: [5, 5] }, ticks: { color: '#a1a1aa', callback: (v) => '₱' + (v >= 1000 ? v / 1000 + 'k' : v) } }
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
                            <span class="text-lg font-bold text-zinc-400 tracking-tight">${area.prev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div class="bg-ambient-900/50 rounded-2xl p-4 border border-zinc-800/50">
                        <span class="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 shadow-sm">Current 7D</span>
                        <div class="flex items-baseline gap-1">
                            <span class="text-xs font-bold text-emerald-600">₱</span>
                            <span class="text-xl font-bold text-white tracking-tight">${area.curr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div class="mt-4 flex items-center justify-between border-t border-zinc-800/50 pt-4 relative z-10">
                    <span class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Growth Shift</span>
                    <div class="text-right">
                        <span class="block text-sm ${isUp ? 'text-emerald-400' : 'text-red-400'} font-black tabular-nums">
                            ${isUp ? '+' : ''}₱${diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        const pSum = t.dailySales.slice(0, mid).reduce((a, b) => a + b, 0);
        const cSum = t.dailySales.slice(mid, days).reduce((a, b) => a + b, 0);

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
    if (badge) {
        badge.innerText = `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%`;
        if (diffPct > 0) {
            badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        } else {
            badge.className = 'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30';
        }
    }

    // Populate Added Summary Cards
    const totalDiffAmount = currTotal - prevTotal;
    const totalDiffEl = document.getElementById('total-difference-amount');
    if (totalDiffEl) {
        animateNumber('total-difference-amount', Math.abs(totalDiffAmount), true);
        if (totalDiffAmount >= 0) {
            totalDiffEl.parentElement.classList.remove('text-red-400');
            totalDiffEl.previousElementSibling.innerText = '+₱';
            totalDiffEl.previousElementSibling.className = 'text-xl text-emerald-500 font-bold';
        } else {
            totalDiffEl.parentElement.classList.remove('text-emerald-400');
            totalDiffEl.previousElementSibling.innerText = '-₱';
            totalDiffEl.previousElementSibling.className = 'text-xl text-red-500 font-bold';
        }
    }

    let incCount = 0;
    let decCount = 0;
    Object.values(shiftData).forEach(s => {
        if (s.curr > s.prev) incCount++;
        else if (s.prev > s.curr) decCount++;
    });

    animateNumber('areas-increased', incCount, false);
    animateNumber('areas-decreased', decCount, false);

    // Chart
    const ctx = document.getElementById('comparisonChart')?.getContext('2d');
    if (ctx) {
        if (charts.comp) charts.comp.destroy();

        const prevDailySum = prevDates.map((_, i) => dashboardData.reduce((s, t) => s + (t.dailySales[i] || 0), 0));
        const currDailySum = currDates.map((_, i) => dashboardData.reduce((s, t) => s + (t.dailySales[mid + i] || 0), 0));

        // Create generic labels Day 1, Day 2 for grouping
        const dualLabels = prevDates.map((d, i) => `Day ${i + 1}`);

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
                    tooltip: { backgroundColor: '#18181b', titleColor: '#fff', bodyColor: '#a1a1aa', callbacks: { label: (ctx) => ' ₱' + ctx.raw.toLocaleString() } }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#27272a' }, ticks: { callback: (v) => '₱' + (v >= 1000 ? v / 1000 + 'k' : v) } }
                }
            }
        });
    }

    // Separate Growth modules
    const listInc = document.getElementById('list-increased');
    const listDec = document.getElementById('list-decreased');

    if (listInc && listDec) {
        const shifts = Object.values(shiftData).map(s => {
            s.diff = s.curr - s.prev;
            s.pct = s.prev > 0 ? (s.diff / s.prev) * 100 : 0;
            return s;
        });

        const increased = shifts.filter(s => s.diff >= 0).sort((a, b) => b.diff - a.diff);
        const decreased = shifts.filter(s => s.diff < 0).sort((a, b) => a.diff - b.diff);

        const renderItem = (s) => `
            <div class="flex items-center justify-between p-4 mb-2 bg-ambient-800/50 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div>
                    <h4 class="text-white font-bold text-sm tracking-wide">${s.name}</h4>
                    <p class="text-xs text-zinc-500 font-medium mt-1">Previous: ₱${s.prev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → <span class="text-zinc-300">₱${s.curr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                </div>
                <div class="text-right">
                    <span class="block ${s.diff >= 0 ? 'text-emerald-400' : 'text-red-400'} font-black tabular-nums">
                        ${s.diff >= 0 ? '+' : ''}₱${s.diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 mt-1 inline-block rounded ${s.pct >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
                        ${s.pct >= 0 ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>'} ${Math.abs(s.pct).toFixed(1)}%
                    </span>
                </div>
            </div>
        `;

        listInc.innerHTML = increased.length > 0 ? increased.map(renderItem).join('') : '<p class="text-zinc-500 italic text-sm p-4 text-center">No units recorded growth.</p>';
        listDec.innerHTML = decreased.length > 0 ? decreased.map(renderItem).join('') : '<p class="text-zinc-500 italic text-sm p-4 text-center">No units recorded deficit.</p>';
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
        obj.innerText = isCurrency ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val;

        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerText = isCurrency ? end.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : end;
    };
    window.requestAnimationFrame(step);
}

// Fallback logic for offline
function useFallbackData() {
    dates = ['03-01-26', '03-02-26', '03-03-26', '03-04-26', '03-05-26', '03-06-26', '03-07-26', '03-08-26', '03-09-26', '03-10-26', '03-11-26', '03-12-26', '03-13-26', '03-14-26'];
    const pGen = (base) => Array.from({ length: 14 }, () => base + Math.floor(Math.random() * 2000));
    dashboardData = [
        { supervisor: 'MONTAWAL SPVR POTS', teller: 'GLADYS JANE G SEBASTIAN', address: 'MONTAWAL POBLACION', isActive: true, dailySales: pGen(2000), total: 0 },
        { supervisor: 'AMPATUAN SPVR TEDDY', teller: 'JENNILYN TOMECUETO', address: 'AMPATUAN KAMASI', isActive: true, dailySales: pGen(5000), total: 0 },
        { supervisor: 'MONTAWAL SPVR POTS', teller: 'AMOR G. ABAN', address: 'DATU MONTAWAL-TUNGGOL', isActive: true, dailySales: pGen(7000), total: 0 }
    ];
    dashboardData.forEach(t => t.total = t.dailySales.reduce((a, b) => a + b, 0));
}

// ================= SYNC LOGIC (FOR COMPARING TWO CSVs) =================
let isSyncFetched = false;

async function fetchSyncData() {
    if (isSyncFetched) return; // Only fetch once unless refreshed

    const loader = document.getElementById('sync-loader');
    const content = document.getElementById('sync-content');
    if (loader) loader.classList.remove('hidden');
    if (content) content.classList.add('hidden');

    try {
        const fetchFile = async (rawUrl) => {
            const cb = new Date().getTime();
            const bustedUrl = `${rawUrl}&_cb=${cb}`;
            const endpoints = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(bustedUrl)}`,
                `https://corsproxy.io/?${encodeURIComponent(bustedUrl)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(bustedUrl)}`
            ];
            const fetchWithValidation = async (url) => {
                const res = await fetch(url);
                if (!res.ok) throw new Error('Bad Status');
                const text = await res.text();
                if (!text.toUpperCase().includes('TELLER')) throw new Error('Invalid CSV');
                return text;
            };
            return await Promise.any(endpoints.map(fetchWithValidation));
        };

        const [febP1Raw, febP2Raw, marRaw] = await Promise.all([
            fetchFile(FEB_P1_CSV_URL),
            fetchFile(FEB_P2_CSV_URL),
            fetchFile(MAR_CSV_URL)
        ]);

        const febP1Data = parseSyncCSV(febP1Raw);
        const febP2Data = parseSyncCSV(febP2Raw);

        const febCombined = {};
        [...febP1Data, ...febP2Data].forEach(t => {
            const key = `${t.supervisor}||${t.teller}`;
            if (!febCombined[key]) {
                febCombined[key] = { supervisor: t.supervisor, teller: t.teller, total: 0 };
            }
            febCombined[key].total += t.total;
        });
        const febData = Object.values(febCombined);

        const marData = parseSyncCSV(marRaw);

        renderSyncResults(febData, marData);
        isSyncFetched = true;

    } catch (err) {
        console.error('Sync failed', err);
        const tbody = document.getElementById('sync-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-10 text-center text-red-500 font-bold uppercase tracking-widest"><i class="fas fa-exclamation-triangle mr-2"></i> Failed to synchronize remote datasets.</td></tr>`;
    } finally {
        if (loader) loader.classList.add('hidden');
        if (content) content.classList.remove('hidden');
    }
}

function parseSyncCSV(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    let currentSupervisor = '';
    let tempResults = [];

    lines.forEach((line) => {
        const cols = parseCSVLine(line);
        if (cols.length < 3) return;

        if (cols[0].trim() !== '' && cols[1] === 'Teller') {
            currentSupervisor = cols[0].split('-').join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
            return;
        }

        if (cols[0] === '' && cols[1] !== '' && cols[1] !== 'Teller' && cols[1].toUpperCase() !== 'TOTAL') {
            const dailySalesArr = cols.slice(3).map(v => parseFloat(v.replace(/,/g, '')) || 0);
            const sumTotal = dailySalesArr.reduce((sum, val) => sum + val, 0);

            if (sumTotal !== 0) {
                tempResults.push({
                    supervisor: currentSupervisor,
                    teller: cols[1].replace(/\s+/g, ' ').trim().toUpperCase(),
                    total: sumTotal
                });
            }
        }
    });
    return tempResults;
}

function renderSyncResults(feb, mar) {
    const febTotal = feb.reduce((s, t) => s + t.total, 0);
    const marTotal = mar.reduce((s, t) => s + t.total, 0);
    const variance = marTotal - febTotal;

    animateNumber('sync-feb-total', febTotal, true);
    animateNumber('sync-mar-total', marTotal, true);
    animateNumber('sync-variance-amount', Math.abs(variance), true);

    const varSymbol = document.getElementById('sync-variance-symbol');
    if (varSymbol) {
        varSymbol.innerText = variance >= 0 ? '+₱' : '-₱';
        varSymbol.className = variance >= 0 ? 'text-xl text-emerald-500 font-bold' : 'text-xl text-red-500 font-bold';
    }

    const varPct = febTotal > 0 ? (variance / febTotal) * 100 : 0;
    const varPctEl = document.getElementById('sync-variance-pct');
    if (varPctEl) {
        varPctEl.innerText = `${variance >= 0 ? '+' : ''}${varPct.toFixed(1)}%`;
        varPctEl.className = variance >= 0 ? 'text-sm font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-sm font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30';
    }

    // Merge by Teller/Supervisor
    const map = {};
    const spvrMap = {};

    feb.forEach(t => {
        const key = `${t.supervisor}||${t.teller}`;
        map[key] = { name: t.teller, spvr: t.supervisor, feb: t.total, mar: 0 };

        if (!spvrMap[t.supervisor]) spvrMap[t.supervisor] = { name: t.supervisor, feb: 0, mar: 0 };
        spvrMap[t.supervisor].feb += t.total;
    });
    mar.forEach(t => {
        const key = `${t.supervisor}||${t.teller}`;
        if (map[key]) {
            map[key].mar += t.total;
        } else {
            map[key] = { name: t.teller, spvr: t.supervisor, feb: 0, mar: t.total };
        }

        if (!spvrMap[t.supervisor]) spvrMap[t.supervisor] = { name: t.supervisor, feb: 0, mar: 0 };
        spvrMap[t.supervisor].mar += t.total;
    });

    const spvrRows = Object.values(spvrMap).sort((a, b) => b.mar - a.mar);

    // Insights Generation
    const insightsEl = document.getElementById('sync-insights-content');
    if (insightsEl) {
        if (spvrRows.length === 0) {
            insightsEl.innerHTML = '<p>No data available to generate insights.</p>';
        } else {
            const growthSpvrs = spvrRows.filter(s => s.mar > s.feb).sort((a, b) => (b.mar - b.feb) - (a.mar - a.feb));
            const deficitSpvrs = spvrRows.filter(s => s.mar < s.feb).sort((a, b) => (a.mar - a.feb) - (b.mar - b.feb));

            let insightHtml = `<p>Overall network performance shifted by <strong class="${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}">${variance >= 0 ? 'an increase' : 'a decrease'} of ₱${Math.abs(variance).toLocaleString()} (${Math.abs(varPct).toFixed(1)}%)</strong> from February to March.</p>`;

            if (growthSpvrs.length > 0) {
                insightHtml += `<p><strong>${growthSpvrs[0].name}</strong> led the expansion with the highest raw growth (+₱${(growthSpvrs[0].mar - growthSpvrs[0].feb).toLocaleString()}).</p>`;
            }
            if (deficitSpvrs.length > 0) {
                insightHtml += `<p class="mt-1">Conversely, <strong>${deficitSpvrs[0].name}</strong> experienced the largest contraction (-₱${Math.abs(deficitSpvrs[0].mar - deficitSpvrs[0].feb).toLocaleString()}).</p>`;
            }

            insightsEl.innerHTML = insightHtml;
        }
    }

    // Render Supervisor Grid
    const spvrGrid = document.getElementById('sync-spvr-grid');
    if (spvrGrid) {
        spvrGrid.innerHTML = spvrRows.map(s => {
            const diff = s.mar - s.feb;
            const pct = s.feb > 0 ? (diff / s.feb) * 100 : 0;
            const isUp = diff >= 0;
            return `
                <div class="glass-card p-5 rounded-2xl border border-zinc-800 flex flex-col group hover:border-zinc-700 transition-all">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] truncate pr-2">${s.name}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}">
                            ${isUp ? '+' : ''}${pct.toFixed(1)}%
                        </span>
                    </div>
                    <div class="flex justify-between items-end">
                        <div>
                            <p class="text-[10px] text-zinc-600 font-bold mb-0.5 uppercase">Performance</p>
                            <div class="flex items-baseline gap-1">
                                <span class="text-xs text-zinc-500">₱</span>
                                <span class="text-base font-black text-white whitespace-nowrap">${s.mar.toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="${isUp ? 'text-emerald-500' : 'text-red-500'} text-[11px] font-bold tabular-nums">
                                ${isUp ? '<i class="fas fa-caret-up"></i>' : '<i class="fas fa-caret-down"></i>'} ₱${Math.abs(diff).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render Sync Chart
    const ctxSync = document.getElementById('syncChart')?.getContext('2d');
    if (ctxSync) {
        if (charts.sync) charts.sync.destroy();

        const labels = Object.values(spvrMap).sort((a, b) => b.mar - a.mar).map(s => s.name);
        const dataFeb = Object.values(spvrMap).sort((a, b) => b.mar - a.mar).map(s => s.feb);
        const dataMar = Object.values(spvrMap).sort((a, b) => b.mar - a.mar).map(s => s.mar);

        charts.sync = new Chart(ctxSync, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'March',
                        data: dataMar,
                        backgroundColor: '#10b981', // emerald-500
                        borderRadius: 4
                    },
                    {
                        label: 'February',
                        data: dataFeb,
                        backgroundColor: '#27272a', // zinc-700
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#a1a1aa' } },
                    tooltip: {
                        backgroundColor: '#18181b',
                        titleColor: '#fff',
                        bodyColor: '#a1a1aa',
                        callbacks: { label: (ctx) => ' ₱' + ctx.raw.toLocaleString(undefined, { minimumFractionDigits: 2 }) }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 10 } } },
                    y: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa', callback: (v) => '₱' + (v >= 1000 ? v / 1000 + 'k' : v) } }
                }
            }
        });
    }

    syncTableData = Object.values(map).sort((a, b) => b.mar - a.mar);
    renderSyncTable(syncTableData);
}

function renderSyncTable(rows) {
    document.getElementById('sync-units-count').innerText = rows.length;

    const tbody = document.getElementById('sync-table-body');
    if (!tbody) return;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-5 text-center text-zinc-500 italic">No exact matches found.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const diff = r.mar - r.feb;
        const pct = r.feb > 0 ? (diff / r.feb) * 100 : (r.mar > 0 ? 100 : 0);
        const isUp = diff >= 0;
        return `
            <tr class="hover:bg-ambient-800/40 transition-colors group">
                <td class="px-8 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-500 flex items-center justify-center font-bold text-xs">
                            ${r.name.charAt(0)}
                        </div>
                        <div>
                            <span class="block text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">${r.name}</span>
                            <span class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">${r.spvr}</span>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-5 text-right font-medium text-zinc-400 tabular-nums">₱${r.feb.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="px-8 py-5 text-right font-bold text-white tabular-nums">₱${r.mar.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="px-8 py-5 text-right">
                    <div class="flex flex-col items-end gap-1">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black tabular-nums ${isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
                            ${isUp ? '<i class="fas fa-caret-up mr-1"></i>+' : '<i class="fas fa-caret-down mr-1"></i>-'}₱${Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span class="text-[10px] font-bold ${isUp ? 'text-emerald-500/60' : 'text-red-500/60'}">
                            ${pct.toFixed(1)}% shifted
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function handleSyncSearch(e) {
    const q = e.target.value.toLowerCase();
    const filtered = syncTableData.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.spvr.toLowerCase().includes(q)
    );
    renderSyncTable(filtered);
}
