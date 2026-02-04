const fs = require('fs');
const path = require('path');

// Read the CSV
const csvPath = path.join(__dirname, '../data/census/jewish_surnames.csv');
const csv = fs.readFileSync(csvPath, 'utf8');

const surnames = csv.trim().split('\n').map(line => {
  const [name, rank, count, prop100k, cum_prop100k, pctwhite, pctblack, pctapi, pctaian, pct2prace, pcthispanic] = line.split(',');
  return {
    name,
    rank: parseInt(rank),
    count: parseInt(count),
    per100k: parseFloat(prop100k),
    demographics: {
      white: pctwhite === '(S)' ? null : parseFloat(pctwhite),
      black: pctblack === '(S)' ? null : parseFloat(pctblack),
      asian: pctapi === '(S)' ? null : parseFloat(pctapi),
      native: pctaian === '(S)' ? null : parseFloat(pctaian),
      multiracial: pct2prace === '(S)' ? null : parseFloat(pct2prace),
      hispanic: pcthispanic === '(S)' ? null : parseFloat(pcthispanic)
    }
  };
});

// Calculate totals
const totalPeople = surnames.reduce((sum, s) => sum + s.count, 0);

// Group by categories
const categories = {
  cohen_tribe: surnames.filter(s => /^(COHEN|KOHN|COHN)$/i.test(s.name)),
  levy_tribe: surnames.filter(s => /^(LEVY|LEVI|LEVIN|LEVINE|LEVINSON|LEVITT)$/i.test(s.name)),
  gold_family: surnames.filter(s => /^GOLD/i.test(s.name)),
  silver_family: surnames.filter(s => /^SILVER/i.test(s.name)),
  berg_suffix: surnames.filter(s => /BERG$/i.test(s.name)),
  stein_suffix: surnames.filter(s => /STEIN$/i.test(s.name)),
  man_suffix: surnames.filter(s => /MAN$/i.test(s.name)),
  witz_suffix: surnames.filter(s => /WITZ$/i.test(s.name)),
  professions: surnames.filter(s => /^(SCHNEIDER|SNYDER|KAUFMAN|KAUFFMAN|ZIMMERMAN|FLEISCHMAN|FLEISCHER|BECKER|FISCHER|FISHER|CANTOR|KANTOR|SINGER|KRAMER|SCHREIBER)$/i.test(s.name)),
  geographic: surnames.filter(s => /^(BERLINER|FRANKFURTER|HOLLANDER|DEUTSCH|POLLACK|POLLOCK|WIENER|WARSHAUER)$/i.test(s.name))
};

const output = {
  meta: {
    source: 'US Census Bureau 2010',
    totalSurnames: surnames.length,
    totalPeople: totalPeople,
    generatedAt: new Date().toISOString()
  },
  surnames: surnames,
  categories: Object.fromEntries(
    Object.entries(categories).map(([key, list]) => [
      key,
      {
        count: list.reduce((sum, s) => sum + s.count, 0),
        names: list.map(s => s.name)
      }
    ])
  ),
  top50: surnames.slice(0, 50).map(s => ({
    name: s.name,
    count: s.count,
    rank: s.rank
  }))
};

// Write output
const outPath = path.join(__dirname, '../data/jewish-surnames.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log('Generated ' + surnames.length + ' surnames');
console.log('Total people: ' + totalPeople.toLocaleString());
console.log('\nCategory totals:');
Object.entries(output.categories).forEach(([key, val]) => {
  console.log('  ' + key + ': ' + val.count.toLocaleString() + ' (' + val.names.length + ' names)');
});

console.log('\nTop 10 surnames:');
surnames.slice(0, 10).forEach((s, i) => {
  console.log('  ' + (i+1) + '. ' + s.name + ': ' + s.count.toLocaleString() + ' people');
});
