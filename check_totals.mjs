import fs from 'fs';

const raw1 = fs.readFileSync('raw1.csv', 'utf8');
const raw2 = fs.readFileSync('raw2.csv', 'utf8');

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

function getTotals(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    let masterTotal = 0;

    lines.forEach((line) => {
        const cols = parseCSVLine(line);
        if (cols.length < 3) return;

        // In Google Sheets, usually there's a row where cols[3] onwards are the totals but look at what says 'TOTAL'
        // If there's an empty cell but it's the total row, maybe the numbers are just there
        if (cols[0] === '' && cols[1] === '' && cols[2] === '') {
            const arr = cols.slice(3).map(v => parseFloat(v.replace(/,/g, '')) || 0);
            const sum = arr.reduce((a, b) => a + b, 0);
            masterTotal += sum;
        }
    });
    return masterTotal;
}

const t1 = getTotals(raw1);
const t2 = getTotals(raw2);

console.log("Raw 1 Totals Row Sum:", t1);
console.log("Raw 2 Totals Row Sum:", t2);
console.log("Combined:", t1 + t2);

