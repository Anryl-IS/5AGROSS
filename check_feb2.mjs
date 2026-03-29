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

const febP1Data = parseSyncCSV(raw1);
const febP2Data = parseSyncCSV(raw2);

const febCombined = {};
[...febP1Data, ...febP2Data].forEach(t => {
    const key = `${t.supervisor}||${t.teller}`;
    if (!febCombined[key]) {
        febCombined[key] = { supervisor: t.supervisor, teller: t.teller, total: 0 };
    }
    febCombined[key].total += t.total;
});
const febData = Object.values(febCombined);

const total = febData.reduce((sum, t) => sum + t.total, 0);

console.log("Calculated Total Feb:", total);

// Let's also check what is the total of JUST P1
const p1Total = febP1Data.reduce((a, b) => a + b.total, 0);
const p2Total = febP2Data.reduce((a, b) => a + b.total, 0);
console.log("P1 Total:", p1Total);
console.log("P2 Total:", p2Total);
