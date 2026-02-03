#!/usr/bin/env node
/**
 * Merge all data sources and generate aggregated points for heat map
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

// Load data files
function loadJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  }
  return { features: [] };
}

// Valid categories
const CATEGORIES = [
  'synagogues', 'restaurants', 'groceries', 'chabad',
  'mikvahs', 'schools', 'jcc', 'judaica', 'vaults'
];

// Create a unique key for deduplication
function featureKey(f) {
  const [lon, lat] = f.geometry.coordinates;
  return `${f.properties.category}-${Math.round(lat * 10000)}-${Math.round(lon * 10000)}`;
}

// Name similarity for deduplication
function similarNames(a, b) {
  if (!a || !b) return false;
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(a) === normalize(b);
}

// Aggregate points into regional clusters for heat map
function createAggregatedPoints(features) {
  // Grid size in degrees (roughly 20-30 miles)
  const GRID_SIZE = 0.3;

  const grid = {};

  for (const feature of features) {
    const [lon, lat] = feature.geometry.coordinates;
    const category = feature.properties.category;

    // Round to grid cell
    const gridLat = Math.round(lat / GRID_SIZE) * GRID_SIZE;
    const gridLon = Math.round(lon / GRID_SIZE) * GRID_SIZE;
    const key = `${category}-${gridLat}-${gridLon}`;

    if (!grid[key]) {
      grid[key] = {
        category,
        count: 0,
        sumLat: 0,
        sumLon: 0,
        names: []
      };
    }

    grid[key].count++;
    grid[key].sumLat += lat;
    grid[key].sumLon += lon;
    if (feature.properties.name && feature.properties.name !== 'Unknown') {
      grid[key].names.push(feature.properties.name);
    }
  }

  // Convert to features
  const aggregated = [];
  for (const [key, data] of Object.entries(grid)) {
    const avgLat = data.sumLat / data.count;
    const avgLon = data.sumLon / data.count;

    // Find a good label (most common city/region name or first named place)
    let label = data.category;
    if (data.names.length > 0) {
      // Try to extract a common location
      const firstPart = data.names[0].split(/[-,]/)[0].trim();
      label = firstPart.length < 30 ? firstPart : data.category;
    }

    aggregated.push({
      type: 'Feature',
      properties: {
        category: data.category,
        name: label,
        weight: data.count
      },
      geometry: {
        type: 'Point',
        coordinates: [avgLon, avgLat]
      }
    });
  }

  return aggregated;
}

// Main
function main() {
  console.log('=== Merging Kosher Konnect Data ===\n');

  // Load all data sources
  const osmData = loadJSON('osm-locations.json');
  const detailedData = loadJSON('locations-detailed.json');

  console.log(`OSM data: ${osmData.features?.length || 0} features`);
  console.log(`Detailed data: ${detailedData.features?.length || 0} features`);

  // Merge with deduplication
  const seen = new Map();
  const merged = [];

  // Add OSM data first (larger dataset)
  for (const f of (osmData.features || [])) {
    if (!CATEGORIES.includes(f.properties?.category)) continue;
    const key = featureKey(f);
    if (!seen.has(key)) {
      seen.set(key, f);
      merged.push(f);
    }
  }

  // Add detailed data (may override OSM if more complete)
  for (const f of (detailedData.features || [])) {
    if (!CATEGORIES.includes(f.properties?.category)) continue;
    const key = featureKey(f);

    // Check if similar location exists
    if (seen.has(key)) {
      const existing = seen.get(key);
      // Prefer entry with more data (website, address)
      const existingScore = (existing.properties.website ? 1 : 0) + (existing.properties.address ? 1 : 0);
      const newScore = (f.properties.website ? 1 : 0) + (f.properties.address ? 1 : 0);
      if (newScore > existingScore) {
        // Replace with better entry
        const idx = merged.indexOf(existing);
        if (idx !== -1) {
          merged[idx] = f;
          seen.set(key, f);
        }
      }
    } else {
      seen.set(key, f);
      merged.push(f);
    }
  }

  console.log(`\nMerged: ${merged.length} unique features`);

  // Print category breakdown
  const byCategory = {};
  for (const f of merged) {
    const cat = f.properties.category;
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  console.log('\nBy category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Write merged detailed data
  const mergedOutput = {
    type: 'FeatureCollection',
    metadata: {
      merged: new Date().toISOString(),
      sources: ['OpenStreetMap', 'Manual additions'],
      license: 'Data from OpenStreetMap contributors (ODbL 1.0)'
    },
    features: merged
  };
  fs.writeFileSync(
    path.join(DATA_DIR, 'locations-detailed.json'),
    JSON.stringify(mergedOutput, null, 2)
  );
  console.log(`\nWrote merged detailed data (${merged.length} features)`);

  // Create aggregated points for heat map
  const aggregated = createAggregatedPoints(merged);
  console.log(`\nCreated ${aggregated.length} aggregated points for heat map`);

  const aggregatedOutput = {
    type: 'FeatureCollection',
    metadata: {
      generated: new Date().toISOString(),
      purpose: 'Heat map visualization',
      note: 'Weight represents number of establishments in area'
    },
    features: aggregated
  };
  fs.writeFileSync(
    path.join(DATA_DIR, 'points.json'),
    JSON.stringify(aggregatedOutput, null, 2)
  );
  console.log('Wrote aggregated points data');

  // Print aggregated breakdown
  const aggByCategory = {};
  let totalWeight = 0;
  for (const f of aggregated) {
    const cat = f.properties.category;
    const weight = f.properties.weight;
    aggByCategory[cat] = (aggByCategory[cat] || 0) + weight;
    totalWeight += weight;
  }
  console.log('\nAggregated totals by category:');
  for (const [cat, count] of Object.entries(aggByCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`\nTotal establishments represented: ${totalWeight}`);

  console.log('\nDone!');
}

main();
