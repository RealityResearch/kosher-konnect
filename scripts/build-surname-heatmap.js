const fs = require('fs');
const path = require('path');

// Load data
const surnames = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jewish-surnames.json'), 'utf8'));
const population = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/jewish-population.json'), 'utf8'));

// State centroids for heatmap points
const stateCentroids = {
  "AL": [-86.9023, 32.3182], "AK": [-153.4937, 64.2008], "AZ": [-111.0937, 34.0489],
  "AR": [-92.3731, 35.2010], "CA": [-119.4179, 36.7783], "CO": [-105.3111, 39.1130],
  "CT": [-72.7554, 41.6032], "DE": [-75.5277, 38.9108], "DC": [-77.0369, 38.9072],
  "FL": [-81.5158, 27.6648], "GA": [-82.9001, 32.1656], "HI": [-155.5828, 19.8968],
  "ID": [-114.7420, 44.0682], "IL": [-89.3985, 40.6331], "IN": [-86.1349, 40.2672],
  "IA": [-93.0977, 41.8780], "KS": [-98.4842, 39.0119], "KY": [-84.2700, 37.8393],
  "LA": [-92.1450, 30.9843], "ME": [-69.4455, 45.2538], "MD": [-76.6413, 39.0458],
  "MA": [-71.3824, 42.4072], "MI": [-85.6024, 44.3148], "MN": [-94.6859, 46.7296],
  "MS": [-89.3985, 32.3547], "MO": [-91.8318, 37.9643], "MT": [-110.3626, 46.8797],
  "NE": [-99.9018, 41.4925], "NV": [-116.4194, 38.8026], "NH": [-71.5724, 43.1939],
  "NJ": [-74.4057, 40.0583], "NM": [-105.8701, 34.5199], "NY": [-75.4999, 43.0000],
  "NC": [-79.0193, 35.7596], "ND": [-101.0020, 47.5515], "OH": [-82.9071, 40.4173],
  "OK": [-97.0929, 35.0078], "OR": [-120.5542, 43.8041], "PA": [-77.1945, 41.2033],
  "RI": [-71.4774, 41.5801], "SC": [-81.1637, 33.8361], "SD": [-99.9018, 43.9695],
  "TN": [-86.5804, 35.5175], "TX": [-99.9018, 31.9686], "UT": [-111.0937, 39.3210],
  "VT": [-72.5778, 44.5588], "VA": [-78.6569, 37.4316], "WA": [-120.7401, 47.7511],
  "WV": [-80.4549, 38.5976], "WI": [-89.6165, 43.7844], "WY": [-107.2903, 43.0760]
};

// Total US Jewish population
const totalJewishPop = Object.values(population.states).reduce((sum, s) => sum + s.population, 0);

// Key surname categories for heatmaps
const surnameCategories = {
  cohen: {
    names: ['COHEN', 'KOHN', 'COHN'],
    color: '#FFD700',
    description: 'Priestly lineage (Kohanim)'
  },
  levy: {
    names: ['LEVY', 'LEVI', 'LEVIN', 'LEVINE', 'LEVINSON', 'LEVITT'],
    color: '#C0C0C0',
    description: 'Levite lineage'
  },
  gold: {
    names: ['GOLDSTEIN', 'GOLDBERG', 'GOLDMAN', 'GOLD', 'GOLDEN', 'GOLDFARB', 'GOLDSMITH'],
    color: '#FFD700',
    description: 'Gold family surnames'
  },
  silver: {
    names: ['SILVER', 'SILVERMAN', 'SILVERSTEIN'],
    color: '#C0C0C0',
    description: 'Silver family surnames'
  },
  schwartz_weiss: {
    names: ['SCHWARTZ', 'SCHWARZ', 'WEISS', 'WEIS'],
    color: '#808080',
    description: 'Black vs White (the eternal rivalry)'
  },
  witz: {
    names: ['HOROWITZ', 'MOSKOWITZ', 'BERKOWITZ', 'RABINOWITZ', 'MARKOWITZ', 'LEFKOWITZ', 'LEIBOWITZ', 'ABRAMOWITZ'],
    color: '#9370DB',
    description: 'Eastern European -witz suffix'
  },
  berg: {
    names: ['GOLDBERG', 'GREENBERG', 'ROSENBERG', 'WEINBERG', 'STEINBERG', 'FRIEDBERG'],
    color: '#228B22',
    description: 'Mountain/hill surnames'
  },
  stein: {
    names: ['GOLDSTEIN', 'BERNSTEIN', 'WEINSTEIN', 'EPSTEIN', 'FINKELSTEIN', 'RUBINSTEIN'],
    color: '#4169E1',
    description: 'Stone surnames'
  }
};

// Calculate surname counts by category
function getCategoryCount(categoryNames) {
  return surnames.surnames
    .filter(s => categoryNames.includes(s.name))
    .reduce((sum, s) => sum + s.count, 0);
}

// Generate heatmap points for each state based on Jewish population proportion
function generateStateHeatmapPoints(categoryNames, categoryName) {
  const nationalCount = getCategoryCount(categoryNames);
  const points = [];

  Object.entries(population.states).forEach(([state, data]) => {
    const coords = stateCentroids[state];
    if (!coords) return;

    // Estimate surnames in this state based on Jewish population proportion
    const stateProportion = data.population / totalJewishPop;
    const estimatedCount = Math.round(nationalCount * stateProportion);

    if (estimatedCount > 0) {
      points.push({
        type: 'Feature',
        properties: {
          state: state,
          category: categoryName,
          estimatedCount: estimatedCount,
          jewishPopulation: data.population,
          density: data.density,
          weight: Math.log10(estimatedCount + 1) // Log scale for heatmap
        },
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      });
    }
  });

  return points;
}

// Generate metro area points (higher resolution)
function generateMetroHeatmapPoints(categoryNames, categoryName) {
  const nationalCount = getCategoryCount(categoryNames);
  const points = [];

  // Calculate total metro Jewish population
  const totalMetroPop = population.metros.reduce((sum, m) => sum + m.population, 0);

  population.metros.forEach(metro => {
    const metroProportion = metro.population / totalJewishPop;
    const estimatedCount = Math.round(nationalCount * metroProportion);

    if (estimatedCount > 0) {
      points.push({
        type: 'Feature',
        properties: {
          metro: metro.name,
          category: categoryName,
          estimatedCount: estimatedCount,
          jewishPopulation: metro.population,
          weight: Math.log10(estimatedCount + 1)
        },
        geometry: {
          type: 'Point',
          coordinates: metro.coordinates
        }
      });
    }
  });

  return points;
}

// Build output
const output = {
  meta: {
    source: 'US Census Bureau 2010 (surnames) + American Jewish Year Book 2020 (population)',
    description: 'Estimated Jewish surname distribution by geography',
    note: 'Counts are estimates based on proportional distribution of national surname data',
    generatedAt: new Date().toISOString()
  },
  categories: {},
  stateHeatmaps: {},
  metroHeatmaps: {}
};

// Generate data for each category
Object.entries(surnameCategories).forEach(([key, category]) => {
  const nationalCount = getCategoryCount(category.names);

  output.categories[key] = {
    names: category.names,
    nationalCount: nationalCount,
    color: category.color,
    description: category.description
  };

  output.stateHeatmaps[key] = {
    type: 'FeatureCollection',
    features: generateStateHeatmapPoints(category.names, key)
  };

  output.metroHeatmaps[key] = {
    type: 'FeatureCollection',
    features: generateMetroHeatmapPoints(category.names, key)
  };
});

// Add combined "all Jewish surnames" heatmap
const allNames = surnames.top50.map(s => s.name);
output.stateHeatmaps.all = {
  type: 'FeatureCollection',
  features: generateStateHeatmapPoints(allNames, 'all')
};
output.metroHeatmaps.all = {
  type: 'FeatureCollection',
  features: generateMetroHeatmapPoints(allNames, 'all')
};

// Write output
fs.writeFileSync(
  path.join(__dirname, '../data/surname-heatmaps.json'),
  JSON.stringify(output, null, 2)
);

// Print summary
console.log('=== SURNAME HEATMAP DATA GENERATED ===\n');
console.log('Categories:');
Object.entries(output.categories).forEach(([key, cat]) => {
  console.log(`  ${key}: ${cat.nationalCount.toLocaleString()} people nationally`);
  console.log(`    Names: ${cat.names.join(', ')}`);
});

console.log('\n=== TOP METROS BY ESTIMATED COHENS ===');
output.metroHeatmaps.cohen.features
  .sort((a, b) => b.properties.estimatedCount - a.properties.estimatedCount)
  .slice(0, 10)
  .forEach((f, i) => {
    console.log(`  ${i+1}. ${f.properties.metro}: ~${f.properties.estimatedCount.toLocaleString()} Cohens`);
  });

console.log('\n=== TOP STATES BY ESTIMATED GOLDBERGS ===');
const goldbergCount = getCategoryCount(['GOLDBERG']);
Object.entries(population.states)
  .map(([state, data]) => ({
    state,
    estimated: Math.round(goldbergCount * (data.population / totalJewishPop))
  }))
  .sort((a, b) => b.estimated - a.estimated)
  .slice(0, 10)
  .forEach((s, i) => {
    console.log(`  ${i+1}. ${s.state}: ~${s.estimated.toLocaleString()} Goldbergs`);
  });
