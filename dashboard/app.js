const BASE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=0&single=true&output=csv';
const PREV_P1_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=0&single=true&output=csv';
const PREV_P2_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=0&single=true&output=csv';
const CURR_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=0&single=true&output=csv';
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
    setupLogin();

    const searchInput = document.getElementById('detailsSearch');
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    const syncSearchInput = document.getElementById('syncSearch');
    if (syncSearchInput) syncSearchInput.addEventListener('input', handleSyncSearch);

    const areasSearchInput = document.getElementById('areas-search');
    if (areasSearchInput) areasSearchInput.addEventListener('input', renderAreas);

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', handleSearch);

    const areasSortBtn = document.getElementById('areas-sort');
    if (areasSortBtn) areasSortBtn.addEventListener('change', renderAreas);

    const syncSpvrSortBtn = document.getElementById('sync-spvr-sort');
    if (syncSpvrSortBtn) syncSpvrSortBtn.addEventListener('change', renderSyncSpvrGrid);

    const syncSpvrSearchBtn = document.getElementById('sync-spvr-search');
    if (syncSpvrSearchBtn) syncSpvrSearchBtn.addEventListener('input', renderSyncSpvrGrid);
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

// Login Handling
function setupLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');

        // Simple mock authentication
        if (user === 'admin' && pass === '123') {
            if (errorEl) errorEl.classList.add('hidden');
            
            // Success animation
            const loginScreen = document.getElementById('login-screen');
            loginScreen.classList.add('opacity-0', 'scale-105', 'pointer-events-none');
            loginScreen.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            
            setTimeout(() => {
                loginScreen.classList.add('hidden');
                const mainContent = document.getElementById('main-content');
                mainContent.classList.remove('hidden');
                mainContent.classList.add('flex', 'animate-fade-in');
                
                // Now start fetching data
                fetchData();
            }, 500);
        } else {
            if (errorEl) {
                errorEl.classList.remove('hidden');
                errorEl.classList.add('animate-shake');
                setTimeout(() => errorEl.classList.remove('animate-shake'), 500);
            }
        }
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

    charts.trend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Gross',
                data: dailyTotals,
                backgroundColor: '#ef4444', // red-500
                borderRadius: 4
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
                    <div class="w-8 h-8 rounded-lg ${t.isActive ? 'bg-red-500/10 text-red-500' : 'bg-zinc-800 text-zinc-500'} flex items-center justify-center font-bold text-xs ring-1 ring-inset ${t.isActive ? 'ring-red-500/30' : 'ring-zinc-700/50'}">
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

function handleSearch() {
    const q = document.getElementById('detailsSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('statusFilter')?.value || 'all';

    const filtered = dashboardData.filter(t => {
        const matchesQuery = t.teller.toLowerCase().includes(q) ||
            t.address.toLowerCase().includes(q) ||
            t.supervisor.toLowerCase().includes(q);

        if (status === 'active') return matchesQuery && t.isActive;
        if (status === 'offline') return matchesQuery && !t.isActive;
        return matchesQuery;
    });
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

    const sortVal = document.getElementById('areas-sort')?.value || 'desc';
    const searchVal = document.getElementById('areas-search')?.value.toLowerCase() || '';

    let sortedAreas = Object.values(areaStats).filter(area => 
        area.name.toLowerCase().includes(searchVal)
    );
    
    if (sortVal === 'desc') sortedAreas.sort((a, b) => (b.curr - b.prev) - (a.curr - a.prev));
    else if (sortVal === 'asc') sortedAreas.sort((a, b) => (a.curr - a.prev) - (b.curr - b.prev));
    else if (sortVal === 'alpha') sortedAreas.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    if (sortedAreas.length === 0) {
        grid.innerHTML = '<p class="text-zinc-500 italic col-span-full text-center p-10">No areas match your filter.</p>';
        return;
    }

    const cardsHtml = sortedAreas.map(area => {
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
                        backgroundColor: '#ef4444',
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

        const [prevP1Raw, prevP2Raw, currRaw] = await Promise.all([
            fetchFile(PREV_P1_CSV_URL),
            fetchFile(PREV_P2_CSV_URL),
            fetchFile(CURR_CSV_URL)
        ]);

        const prevP1Data = parseSyncCSV(prevP1Raw);
        const prevP2Data = parseSyncCSV(prevP2Raw);

        const prevCombined = {};
        [...prevP1Data, ...prevP2Data].forEach(t => {
            const key = `${t.supervisor}||${t.teller}`;
            if (!prevCombined[key]) {
                prevCombined[key] = { supervisor: t.supervisor, teller: t.teller, total: 0 };
            }
            prevCombined[key].total += t.total;
        });
        const prevData = Object.values(prevCombined);

        const currData = parseSyncCSV(currRaw);

        renderSyncResults(prevData, currData);
        isSyncFetched = true;

    } catch (err) {
        console.error('Sync failed', err);
        useFallbackSyncData();
        updateStatus('Offline Sync Demo', false);
        isSyncFetched = true; // Still allow viewing demo data
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

function renderSyncResults(prev, curr) {
    const prevTotal = prev.reduce((s, t) => s + t.total, 0);
    const currTotal = curr.reduce((s, t) => s + t.total, 0);
    const variance = currTotal - prevTotal;

    animateNumber('sync-feb-total', prevTotal, true);
    animateNumber('sync-mar-total', currTotal, true);
    animateNumber('sync-variance-amount', Math.abs(variance), true);

    const varSymbol = document.getElementById('sync-variance-symbol');
    if (varSymbol) {
        varSymbol.innerText = variance >= 0 ? '+₱' : '-₱';
        varSymbol.className = variance >= 0 ? 'text-xl text-emerald-500 font-bold' : 'text-xl text-red-500 font-bold';
    }

    const varPct = prevTotal > 0 ? (variance / prevTotal) * 100 : 0;
    const varPctEl = document.getElementById('sync-variance-pct');
    if (varPctEl) {
        varPctEl.innerText = `${variance >= 0 ? '+' : ''}${varPct.toFixed(1)}%`;
        varPctEl.className = variance >= 0 ? 'text-sm font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-sm font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30';
    }

    // Merge by Teller/Supervisor
    const map = {};
    const spvrMap = {};

    prev.forEach(t => {
        const key = `${t.supervisor}||${t.teller}`;
        map[key] = { name: t.teller, spvr: t.supervisor, prev: t.total, curr: 0 };

        if (!spvrMap[t.supervisor]) spvrMap[t.supervisor] = { name: t.supervisor, prev: 0, curr: 0 };
        spvrMap[t.supervisor].prev += t.total;
    });
    curr.forEach(t => {
        const key = `${t.supervisor}||${t.teller}`;
        if (map[key]) {
            map[key].curr += t.total;
        } else {
            map[key] = { name: t.teller, spvr: t.supervisor, prev: 0, curr: t.total };
        }

        if (!spvrMap[t.supervisor]) spvrMap[t.supervisor] = { name: t.supervisor, prev: 0, curr: 0 };
        spvrMap[t.supervisor].curr += t.total;
    });

    const spvrRows = Object.values(spvrMap).sort((a, b) => b.curr - a.curr);

    // Insights Generation
    const insightsEl = document.getElementById('sync-insights-content');
    if (insightsEl) {
        if (spvrRows.length === 0) {
            insightsEl.innerHTML = '<p>No data available to generate insights.</p>';
        } else {
            const growthSpvrs = spvrRows.filter(s => s.curr > s.prev).sort((a, b) => (b.curr - b.prev) - (a.curr - a.prev));
            const deficitSpvrs = spvrRows.filter(s => s.curr < s.prev).sort((a, b) => (a.curr - a.prev) - (b.curr - b.prev));

            let insightHtml = `<p>Overall network performance shifted by <strong class="${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}">${variance >= 0 ? 'an increase' : 'a decrease'} of ₱${Math.abs(variance).toLocaleString()} (${Math.abs(varPct).toFixed(1)}%)</strong> from Previous to Current period.</p>`;

            if (growthSpvrs.length > 0) {
                insightHtml += `<p><strong>${growthSpvrs[0].name}</strong> led the expansion with the highest raw growth (+₱${(growthSpvrs[0].curr - growthSpvrs[0].prev).toLocaleString()}).</p>`;
            }
            if (deficitSpvrs.length > 0) {
                insightHtml += `<p class="mt-1">Conversely, <strong>${deficitSpvrs[0].name}</strong> experienced the largest contraction (-₱${Math.abs(deficitSpvrs[0].curr - deficitSpvrs[0].prev).toLocaleString()}).</p>`;
            }

            insightsEl.innerHTML = insightHtml;
        }
    }

    // Render Supervisor Grid
    window.currentSyncSpvrMap = spvrMap;
    renderSyncSpvrGrid();

    // Render Sync Chart
    const ctxSync = document.getElementById('syncChart')?.getContext('2d');
    if (ctxSync) {
        if (charts.sync) charts.sync.destroy();

        const labels = Object.values(spvrMap).sort((a, b) => b.curr - a.curr).map(s => s.name);
        const dataPrev = Object.values(spvrMap).sort((a, b) => b.curr - a.curr).map(s => s.prev);
        const dataCurr = Object.values(spvrMap).sort((a, b) => b.curr - a.curr).map(s => s.curr);

        charts.sync = new Chart(ctxSync, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Current Period',
                        data: dataCurr,
                        backgroundColor: '#10b981', // emerald-500
                        borderRadius: 4
                    },
                    {
                        label: 'Previous Period',
                        data: dataPrev,
                        backgroundColor: '#27272a', // zinc-700
                        borderRadius: 4
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: '#a1a1aa', boxWidth: 12, font: { size: 10, weight: 'bold' } } },
                    tooltip: {
                        backgroundColor: '#18181b',
                        titleColor: '#fff',
                        bodyColor: '#a1a1aa',
                        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ₱${ctx.raw.toLocaleString()}` }
                    }
                },
                scales: {
                    x: { 
                        grid: { color: '#27272a' }, 
                        ticks: { color: '#a1a1aa', font: { size: 9 }, callback: (v) => '₱' + (v >= 1000000 ? (v / 1000000) + 'M' : (v / 1000) + 'k') } 
                    },
                    y: { 
                        grid: { display: false }, 
                        ticks: { color: '#fff', font: { size: 10, weight: 'bold' } } 
                    }
                }
            }
        });
    }

    syncTableData = Object.values(map).sort((a, b) => b.curr - a.curr);
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
        const diff = r.curr - r.prev;
        const pct = r.prev > 0 ? (diff / r.prev) * 100 : (r.curr > 0 ? 100 : 0);
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
                <td class="px-8 py-5 text-right font-medium text-zinc-400 tabular-nums">₱${r.prev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="px-8 py-5 text-right font-bold text-white tabular-nums">₱${r.curr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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

function renderSyncSpvrGrid() {
    const spvrGrid = document.getElementById('sync-spvr-grid');
    if (!spvrGrid || !window.currentSyncSpvrMap) return;

    const sortVal = document.getElementById('sync-spvr-sort')?.value || 'desc';
    const searchVal = document.getElementById('sync-spvr-search')?.value.toLowerCase() || '';

    let rows = Object.values(window.currentSyncSpvrMap).filter(s => 
        s.name.toLowerCase().includes(searchVal)
    );
    
    if (sortVal === 'desc') rows.sort((a, b) => (b.curr - b.prev) - (a.curr - a.prev));
    else if (sortVal === 'asc') rows.sort((a, b) => (a.curr - a.prev) - (b.curr - b.prev));
    else if (sortVal === 'alpha') rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    if (rows.length === 0) {
        spvrGrid.innerHTML = `<div class="p-8 text-center text-zinc-500 italic border border-zinc-800 rounded-2xl">No supervisors match your search.</div>`;
        return;
    }

    spvrGrid.innerHTML = rows.map(s => {
        const diff = s.mar - s.feb;
        const pct = s.feb > 0 ? (diff / s.feb) * 100 : (s.mar > 0 ? 100 : 0);
        const isUp = diff >= 0;
        return `
            <div class="glass-card p-3 px-5 rounded-2xl border border-zinc-800/80 flex items-center justify-between group hover:border-zinc-700 hover:bg-zinc-800/20 transition-all">
                <div class="flex items-center gap-4 w-1/3">
                    <div class="w-8 h-8 rounded-lg bg-ambient-800 border border-zinc-700/50 flex items-center justify-center text-zinc-500 group-hover:text-red-500 transition-colors">
                        <i class="fas fa-id-badge text-sm"></i>
                    </div>
                    <span class="text-xs font-bold text-zinc-300 group-hover:text-white truncate">${s.name}</span>
                </div>
                
                <div class="flex-1 flex items-center justify-center gap-8">
                    <div class="text-right">
                        <p class="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-0.5">Previous</p>
                        <p class="text-xs font-medium text-zinc-500 tabular-nums">₱${s.prev.toLocaleString()}</p>
                    </div>
                    <div class="text-zinc-800"><i class="fas fa-chevron-right text-xs"></i></div>
                    <div class="text-left">
                        <p class="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-0.5">Current</p>
                        <div class="flex items-baseline gap-1">
                             <p class="text-sm font-black text-white tabular-nums">₱${s.curr.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div class="w-1/4 flex flex-col items-end">
                    <div class="flex items-center gap-2">
                        <span class="${isUp ? 'text-emerald-400' : 'text-red-400'} text-sm font-black tabular-nums">
                            ${isUp ? '+' : '-'}₱${Math.abs(diff).toLocaleString()}
                        </span>
                        <div class="px-2 py-0.5 rounded-md text-[10px] font-bold ${isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
                            ${isUp ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function useFallbackSyncData() {
    const spvrs = ['MAGUINDANAO SPVR POTS', 'LANAO SPVR TEDDY', 'NORTH COTABATO SPVR RAMSIE', 'SULTAN KUDARAT SPVR HARIF'];
    const febData = spvrs.map(s => ({ supervisor: s, teller: `TELLER ${s.charAt(0)}`, total: 4000000 + Math.random() * 1000000 }));
    const marData = spvrs.map(s => ({ supervisor: s, teller: `TELLER ${s.charAt(0)}`, total: 3800000 + Math.random() * 1500000 }));
    renderSyncResults(febData, marData);
}

async function exportComparisonToExcel() {
    const days = dates.length;
    const mid = Math.floor(days / 2);
    if (days < 2) return;

    let shiftData = {};
    dashboardData.forEach(t => {
        const pSum = t.dailySales.slice(0, mid).reduce((a, b) => a + b, 0);
        const cSum = t.dailySales.slice(mid, days).reduce((a, b) => a + b, 0);
        if (!shiftData[t.supervisor]) shiftData[t.supervisor] = { prev: 0, curr: 0, name: t.supervisor };
        shiftData[t.supervisor].prev += pSum;
        shiftData[t.supervisor].curr += cSum;
    });

    const shifts = Object.values(shiftData).map(s => {
        s.diff = s.curr - s.prev;
        s.pct = s.prev > 0 ? (s.diff / s.prev) * 100 : 0;
        return s;
    });

    const increased = shifts.filter(s => s.diff >= 0).sort((a, b) => b.diff - a.diff);
    const decreased = shifts.filter(s => s.diff < 0).sort((a, b) => a.diff - b.diff);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Trajectory Analysis');

    // Title Section
    worksheet.mergeCells('A1:E2');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'IMPERIAL GAMING - TRAJECTORY ANALYSIS REPORT';
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A3:E3');
    const subtitleCell = worksheet.getCell('A3');
    subtitleCell.value = `Exported on: ${new Date().toLocaleString()} | Period: ${dates[0]} to ${dates[dates.length - 1]}`;
    subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF71717A' } };
    subtitleCell.alignment = { horizontal: 'center' };

    let currRow = 5;

    // Growth Trajectory Table
    const growthTitleRow = worksheet.getRow(currRow);
    growthTitleRow.getCell(1).value = 'GROWTH TRAJECTORY (Net Positive Shift)';
    growthTitleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
    currRow++;

    const headers = ['Operational Area / Supervisor', 'Previous Period (7D)', 'Current Period (7D)', 'Net Difference', 'Shift %'];
    const growthHeaderRow = worksheet.addRow(headers);
    growthHeaderRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        cell.border = { bottom: { style: 'thin' } };
    });
    currRow++;

    increased.forEach(s => {
        const row = worksheet.addRow([s.name, s.prev, s.curr, s.diff, (s.pct / 100)]);
        row.getCell(2).numFmt = '\"₱\"#,##0.00';
        row.getCell(3).numFmt = '\"₱\"#,##0.00';
        row.getCell(4).numFmt = '\"₱\"#,##0.00';
        row.getCell(5).numFmt = '0.0%';
        row.getCell(4).font = { color: { argb: 'FF059669' }, bold: true };
        currRow++;
    });

    currRow += 2;

    // Deficit Risk Table
    const deficitTitleRow = worksheet.getRow(currRow);
    deficitTitleRow.getCell(1).value = 'DEFICIT RISK (Net Negative Shift)';
    deficitTitleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFDC2626' } };
    currRow++;

    const deficitHeaderRow = worksheet.addRow(headers);
    deficitHeaderRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
        cell.border = { bottom: { style: 'thin' } };
    });
    currRow++;

    decreased.forEach(s => {
        const row = worksheet.addRow([s.name, s.prev, s.curr, s.diff, (s.pct / 100)]);
        row.getCell(2).numFmt = '\"₱\"#,##0.00';
        row.getCell(3).numFmt = '\"₱\"#,##0.00';
        row.getCell(4).numFmt = '\"₱\"#,##0.00';
        row.getCell(5).numFmt = '0.0%';
        row.getCell(4).font = { color: { argb: 'FFDC2626' }, bold: true };
        currRow++;
    });

    // Formatting
    worksheet.columns.forEach(col => {
        col.width = 30;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `LDS_Trajectory_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

// ================= EXCEL EXPORT LOGIC =================
function exportDetailsToExcel() {
    const data = dashboardData.map(r => ({
        'Teller Name': r.teller,
        'Branch': r.branch,
        'Supervisor': r.supervisor,
        'Total Gross': r.total,
        'Status': r.isActive ? 'Active' : 'Inactive'
    }));
    downloadExcel(data, 'LDS_Detailed_Breakdown');
}

function exportAreasToExcel() {
    const sortVal = document.getElementById('areas-sort')?.value || 'desc';
    const areaStats = {};
    const mid = Math.floor(dates.length / 2);
    
    dashboardData.forEach(t => {
        if (!areaStats[t.supervisor]) areaStats[t.supervisor] = { name: t.supervisor, prev: 0, curr: 0 };
        areaStats[t.supervisor].prev += t.dailySales.slice(0, mid).reduce((a, b) => a + b, 0);
        areaStats[t.supervisor].curr += t.dailySales.slice(mid, dates.length).reduce((a, b) => a + b, 0);
    });

    const rows = Object.values(areaStats).map(a => {
        const diff = a.curr - a.prev;
        return {
            'Area/Supervisor': a.name,
            'Previous Period': a.prev,
            'Current Period': a.curr,
            'Difference': diff,
            'Shift %': a.prev > 0 ? ((diff / a.prev) * 100).toFixed(2) + '%' : '0%'
        };
    });

    downloadExcel(rows, 'Area_Diagnostics');
}

function exportSyncToExcel() {
    if (!window.currentSyncSpvrMap) return;
    const rows = Object.values(window.currentSyncSpvrMap).map(s => {
        const diff = s.curr - s.prev;
        return {
            'Supervisor': s.name,
            'Previous Period Total': s.prev,
            'Current Period Total': s.curr,
            'Net Shift': diff,
            'Shift %': s.prev > 0 ? ((diff / s.prev) * 100).toFixed(2) + '%' : '0%'
        };
    });
    downloadExcel(rows, 'Supervisor_Performance_Shift');
}

async function downloadExcel(data, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('System Export');

    // Header Style
    const headerRow = worksheet.addRow(Object.keys(data[0]));
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Content Rows
    data.forEach(item => {
        const row = worksheet.addRow(Object.values(item));
        
        // Find if this is a comparative row (contains Shift or Difference)
        const keys = Object.keys(item);
        keys.forEach((key, idx) => {
            const cell = row.getCell(idx + 1);
            const val = item[key];

            // Auto-detect Currency and Format
            if (typeof val === 'number' && (key.includes('Total') || key.includes('Gross') || key.includes('Difference') || key.includes('Shift') || key.includes('Period'))) {
                cell.numFmt = '\"₱\"#,##0.00';
            }

            // Apply Conditional Colors (Primary Logic)
            if (key.includes('Shift') || key.includes('Difference')) {
                const numericVal = typeof val === 'string' ? parseFloat(val) : val;
                if (numericVal > 0) {
                    cell.font = { bold: true, color: { argb: 'FF10B981' } }; // emerald-500
                } else if (numericVal < 0) {
                    cell.font = { bold: true, color: { argb: 'FFEF4444' } }; // red-500
                }
            }
        });
    });

    // Final Styling (Columns)
    worksheet.columns.forEach(col => {
        col.width = 24;
    });

    // Generate and Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}


