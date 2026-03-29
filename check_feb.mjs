import fs from 'fs';

const url1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=811706992&single=true&output=csv';
const url2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=130106578&single=true&output=csv';

async function fetchWithCors(u) {
    const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(u));
    return await r.text();
}

function processCSV(csvRaw) {
    const lines = csvRaw.split(/\r?\n/);
    let total = 0;
    
    // Simplest logic to see what parseCSVLine sees
    lines.forEach(line => {
        const cols = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuotes = !inQuotes;
            else if (line[i] === ',' && !inQuotes) { cols.push(cur); cur = ''; }
            else cur += line[i];
        }
        cols.push(cur);
        
        if (cols.length < 3) return;
        if (cols[0] === '' && cols[1] !== '' && cols[1] !== 'Teller' && cols[1].toUpperCase() !== 'TOTAL') {
            const arr = cols.slice(3).map(v => parseFloat(v.replace(/,/g, '')) || 0);
            const sum = arr.reduce((a, b) => a + b, 0);
            total += sum;
        }
    });
    return total;
}

async function main() {
    const raw1 = await fetchWithCors(url1);
    const raw2 = await fetchWithCors(url2);
    
    fs.writeFileSync('raw1.csv', raw1);
    fs.writeFileSync('raw2.csv', raw2);
    
    console.log("Written to raw1.csv and raw2.csv");
    
    console.log("Raw 1 length:", raw1.length);
    console.log("Raw 2 length:", raw2.length);
    
    console.log("URL 1 Total:", processCSV(raw1));
    console.log("URL 2 Total:", processCSV(raw2));
}

main();
