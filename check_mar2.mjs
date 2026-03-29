import fs from 'fs';

const raw3 = fs.readFileSync('raw3.csv', 'utf8');

const lines = raw3.split(/\r?\n/).slice(0, 5);
lines.forEach(l => console.log(l));
