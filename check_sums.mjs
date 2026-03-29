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

function getSupervisorSums(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    let currentSupervisor = '';
    const sums = {};

    lines.forEach((line) => {
        const cols = parseCSVLine(line);
        if (cols.length < 3) return;

        if (cols[0].trim() !== '' && cols[1] === 'Teller') {
            currentSupervisor = cols[0].split('-').join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
            sums[currentSupervisor] = 0;
            return;
        }

        if (cols[0] === '' && cols[1] !== '' && cols[1] !== 'Teller' && cols[1].toUpperCase() !== 'TOTAL') {
            const arr = cols.slice(3).map(v => parseFloat(v.replace(/,/g, '')) || 0);
            const sum = arr.reduce((a, b) => a + b, 0);
            if (sums[currentSupervisor] !== undefined) sums[currentSupervisor] += sum;
        }
    });
    return sums;
}

const s1 = getSupervisorSums(raw1);
const s2 = getSupervisorSums(raw2);

console.log("Supervisor Sums P1:");
for (let k in s1) if (s1[k] === 7122403) console.log(k, s1[k]);

console.log("Supervisor Sums P2:");
for (let k in s2) if (s2[k] === 7122403) console.log(k, s2[k]);

// Let's print out the actual values for ALL supervisors if they sum to exactly 7,122,403 together? No.
