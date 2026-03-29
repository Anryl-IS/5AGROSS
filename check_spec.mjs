import fs from 'fs';

const raw2 = fs.readFileSync('raw2.csv', 'utf8');

function sumSpecificColumns(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    let masterTotal = 0;

    lines.forEach((line) => {
        const cols = line.split(',');
        if (cols.length < 3) return;

        // cols[0] is superv, cols[1] is teller, cols[2] is address
        if (cols[0] === '' && cols[1] === '' && cols[2] === '') {
            const arr = cols.slice(3); // 15 columns
            // cols: 3..14 are 1/26/2002... 15,16,17 are 02-13...
            // Let's sum specifically the last 3 columns
            if (arr.length >= 3) {
                const specArr = arr.slice(-3);
                const sum = specArr.map(v => parseFloat(v.replace(/,/g, '')) || 0).reduce((a, b) => a + b, 0);
                masterTotal += sum;
            }
        }
    });
    return masterTotal;
}

console.log("Last 3 columns of raw2:", sumSpecificColumns(raw2));
