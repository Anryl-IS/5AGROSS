import fs from 'fs';

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=0&single=true&output=csv';

async function main() {
    const raw = await fetch('https://corsproxy.io/?' + encodeURIComponent(url)).then(r => r.text());
    let total = 0;
    const lines = raw.split(/\r?\n/);
    lines.forEach(line => {
        const cols = [];
        let cur = '';
        let inQuotes = false;
        for (let c of line) {
            if (c === '"') inQuotes = !inQuotes;
            else if (c === ',' && !inQuotes) { cols.push(cur); cur = ''; }
            else cur += c;
        }
        cols.push(cur);
        
        if (cols.length < 3) return;
        if (cols[0] === '' && cols[1] !== '' && cols[1] !== 'Teller' && cols[1].toUpperCase() !== 'TOTAL') {
            const arr = cols.slice(3).map(v => parseFloat(v.replace(/,/g, '')) || 0);
            const sum = arr.reduce((a, b) => a + b, 0);
            total += sum;
        }
    });
    console.log("BASE CSV Total:", total);
}
main();
