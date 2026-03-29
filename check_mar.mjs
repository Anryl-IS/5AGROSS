import fs from 'fs';

const raw3 = fs.readFileSync('raw3.csv', 'utf8');

function parseCSVLine(line) {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let c of line) {
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) { cols.push(cur); cur = ''; }
        else cur += c;
    }
    cols.push(cur);
    return cols;
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

const marData = parseSyncCSV(raw3);

const total = marData.reduce((sum, t) => sum + t.total, 0);

console.log("Calculated Total March:", total);
