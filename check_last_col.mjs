import fs from 'fs';

const raw1 = fs.readFileSync('raw1.csv', 'utf8');

function sumLastColumn(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    let masterTotal = 0;

    lines.forEach((line) => {
        const cols = line.split(',');
        if (cols.length < 3) return;

        if (cols[0] === '' && cols[1] === '' && cols[2] === '') {
            const sum = parseFloat(cols[cols.length - 1].replace(/,/g, '')) || 0;
            masterTotal += sum;
        }
    });
    return masterTotal;
}

console.log("Last column raw1 sum:", sumLastColumn(raw1));
