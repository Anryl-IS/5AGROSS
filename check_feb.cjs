const https = require('https');
const fs = require('fs');

const url1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=811706992&single=true&output=csv';
const url2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHNgLs14x9JzMkkOW8eQHCeXon0n_rsjFVuDHymx2mmgkB5WV8_WkOvkF9cvmAuE8N9usedhTdqbH8/pub?gid=130106578&single=true&output=csv';

https.get(url1, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => fs.writeFileSync('url1.csv', data.substring(0, 1000)));
});

https.get(url2, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => fs.writeFileSync('url2.csv', data.substring(0, 1000)));
});
