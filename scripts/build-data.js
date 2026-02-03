#!/usr/bin/env node
// Script to build and validate location data for Kosher Konnect
// This script can:
// 1. Merge detailed locations with aggregated points data
// 2. Add new locations from OSM or manual input
// 3. Validate and normalize the data format

const fs = require('fs');
const path = require('path');

// File paths
const DATA_DIR = path.join(__dirname, '../data');
const DETAILED_FILE = path.join(DATA_DIR, 'locations-detailed.json');
const POINTS_FILE = path.join(DATA_DIR, 'points.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'locations-combined.json');

// Valid categories
const VALID_CATEGORIES = [
  'synagogues', 'restaurants', 'groceries', 'chabad',
  'mikvahs', 'schools', 'jcc', 'judaica'
];

// Parse JSON safely
function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    return { type: "FeatureCollection", features: [] };
  }
}

// Convert OSM element to our GeoJSON format
function osmToFeature(element, category) {
  const name = element.tags?.name || 'Unknown';
  const address = [
    element.tags?.['addr:housenumber'],
    element.tags?.['addr:street'],
    element.tags?.['addr:city'],
    element.tags?.['addr:state']
  ].filter(Boolean).join(', ') || null;

  return {
    type: "Feature",
    properties: {
      category,
      name,
      address,
      website: element.tags?.website || element.tags?.url || null,
      phone: element.tags?.phone || null,
      weight: 1
    },
    geometry: {
      type: "Point",
      coordinates: [element.lon, element.lat]
    }
  };
}

// Validate a feature has required fields
function validateFeature(feature) {
  const errors = [];

  if (feature.type !== 'Feature') {
    errors.push('Missing or invalid type');
  }

  if (!feature.properties?.category) {
    errors.push('Missing category');
  } else if (!VALID_CATEGORIES.includes(feature.properties.category)) {
    errors.push(`Invalid category: ${feature.properties.category}`);
  }

  if (!feature.properties?.name) {
    errors.push('Missing name');
  }

  if (!feature.geometry?.coordinates || feature.geometry.coordinates.length !== 2) {
    errors.push('Invalid coordinates');
  } else {
    const [lon, lat] = feature.geometry.coordinates;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      errors.push('Coordinates out of range');
    }
  }

  return errors;
}

// Load existing data
function loadData() {
  const result = { detailed: null, points: null };

  if (fs.existsSync(DETAILED_FILE)) {
    const raw = fs.readFileSync(DETAILED_FILE, 'utf-8');
    result.detailed = safeParseJSON(raw);
    console.log(`Loaded ${result.detailed.features?.length || 0} detailed locations`);
  }

  if (fs.existsSync(POINTS_FILE)) {
    const raw = fs.readFileSync(POINTS_FILE, 'utf-8');
    result.points = safeParseJSON(raw);
    console.log(`Loaded ${result.points.features?.length || 0} aggregated points`);
  }

  return result;
}

// Get statistics about the data
function getStats(features) {
  const stats = {
    total: features.length,
    byCategory: {},
    withWebsite: 0,
    withAddress: 0,
    withPhone: 0
  };

  for (const feature of features) {
    const cat = feature.properties?.category || 'unknown';
    stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

    if (feature.properties?.website) stats.withWebsite++;
    if (feature.properties?.address) stats.withAddress++;
    if (feature.properties?.phone) stats.withPhone++;
  }

  return stats;
}

// Main execution
console.log('=== Kosher Konnect Data Builder ===\n');

const { detailed, points } = loadData();

if (!detailed && !points) {
  console.error('No data files found!');
  process.exit(1);
}

// Validate detailed locations
if (detailed?.features) {
  console.log('\nValidating detailed locations...');
  let validCount = 0;
  let invalidCount = 0;

  for (const feature of detailed.features) {
    const errors = validateFeature(feature);
    if (errors.length > 0) {
      invalidCount++;
      // Uncomment to see validation errors:
      // console.log(`  Invalid: ${feature.properties?.name || 'unknown'} - ${errors.join(', ')}`);
    } else {
      validCount++;
    }
  }

  console.log(`  Valid: ${validCount}, Invalid: ${invalidCount}`);

  // Print statistics
  console.log('\nData Statistics:');
  const stats = getStats(detailed.features);
  console.log(`  Total locations: ${stats.total}`);
  console.log('  By category:');
  for (const [cat, count] of Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log(`  With website: ${stats.withWebsite} (${Math.round(stats.withWebsite/stats.total*100)}%)`);
  console.log(`  With address: ${stats.withAddress} (${Math.round(stats.withAddress/stats.total*100)}%)`);
}

// Create combined output (detailed locations take precedence for display)
const combinedFeatures = [];

if (detailed?.features) {
  combinedFeatures.push(...detailed.features);
}

// Write combined output
const output = {
  type: "FeatureCollection",
  metadata: {
    generated: new Date().toISOString(),
    detailedCount: detailed?.features?.length || 0,
    pointsCount: points?.features?.length || 0
  },
  features: combinedFeatures
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`\nWrote ${combinedFeatures.length} features to ${OUTPUT_FILE}`);

console.log('\nDone!');
