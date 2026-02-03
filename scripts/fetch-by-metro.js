#!/usr/bin/env node
/**
 * Fetch kosher establishments by metro area (smaller queries that don't time out)
 */

const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Major metros with Jewish populations
const METROS = [
  { name: 'NYC Area', bbox: '40.4,-74.3,41.0,-73.5' },
  { name: 'Long Island', bbox: '40.5,-73.8,41.2,-71.8' },
  { name: 'NJ North', bbox: '40.5,-74.5,41.3,-74.0' },
  { name: 'Los Angeles', bbox: '33.7,-118.7,34.4,-117.8' },
  { name: 'Miami', bbox: '25.5,-80.5,26.5,-80.0' },
  { name: 'Chicago', bbox: '41.6,-88.0,42.2,-87.4' },
  { name: 'Philadelphia', bbox: '39.8,-75.4,40.2,-74.9' },
  { name: 'Boston', bbox: '42.2,-71.3,42.5,-70.9' },
  { name: 'Baltimore', bbox: '39.2,-76.8,39.5,-76.4' },
  { name: 'DC Area', bbox: '38.8,-77.2,39.1,-76.9' },
  { name: 'Detroit', bbox: '42.2,-83.4,42.6,-82.9' },
  { name: 'Cleveland', bbox: '41.3,-81.8,41.6,-81.4' },
  { name: 'Atlanta', bbox: '33.6,-84.6,34.0,-84.2' },
  { name: 'Denver', bbox: '39.5,-105.1,39.9,-104.7' },
  { name: 'Phoenix', bbox: '33.3,-112.2,33.7,-111.8' },
  { name: 'San Francisco', bbox: '37.6,-122.6,37.9,-122.2' },
  { name: 'Seattle', bbox: '47.4,-122.5,47.8,-122.1' },
  { name: 'Dallas', bbox: '32.6,-97.0,33.0,-96.5' },
  { name: 'Houston', bbox: '29.5,-95.6,30.0,-95.1' }
];

async function fetchMetro(metro) {
  const query = `
    [out:json][timeout:60][bbox:${metro.bbox}];
    (
      nwr["diet:kosher"="yes"];
      nwr["kosher"="yes"];
      nwr["cuisine"~"kosher",i];
      nwr["name"~"Chabad",i]["amenity"];
    );
    out center;
  `;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      return { elements: [] };
    }

    return await response.json();
  } catch (e) {
    return { elements: [] };
  }
}

function osmToFeature(element) {
  let lon, lat;
  if (element.center) {
    lon = element.center.lon;
    lat = element.center.lat;
  } else {
    lon = element.lon;
    lat = element.lat;
  }
  if (!lon || !lat) return null;

  const tags = element.tags || {};
  const name = tags.name || 'Unknown';

  // Determine category
  let category = 'restaurants';
  if (tags.name && /chabad/i.test(tags.name)) {
    category = 'chabad';
  } else if (tags.shop === 'supermarket' || tags.shop === 'grocery' || tags.shop === 'kosher') {
    category = 'groceries';
  } else if (tags.shop === 'bakery') {
    category = 'restaurants'; // bakeries are food
  }

  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state']
  ].filter(Boolean);

  return {
    type: 'Feature',
    properties: {
      category,
      name,
      address: addressParts.length > 0 ? addressParts.join(', ') : null,
      website: tags.website || tags.url || null,
      phone: tags.phone || null,
      cuisine: tags.cuisine || null,
      osmId: element.id,
      weight: 1
    },
    geometry: {
      type: 'Point',
      coordinates: [lon, lat]
    }
  };
}

async function main() {
  console.log('=== Fetching by Metro Area ===\n');

  const allFeatures = [];

  for (const metro of METROS) {
    process.stdout.write(`${metro.name}... `);
    const data = await fetchMetro(metro);
    const features = data.elements
      .map(el => osmToFeature(el))
      .filter(f => f !== null);
    console.log(`${features.length} found`);
    allFeatures.push(...features);

    // Small delay
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nTotal fetched: ${allFeatures.length}`);

  // Load and merge
  const dataPath = path.join(__dirname, '../data/osm-locations.json');
  const existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Deduplicate
  const seen = new Set();
  for (const f of existing.features) {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${f.properties.category}-${Math.round(lat * 10000)}-${Math.round(lon * 10000)}`;
    seen.add(key);
  }

  let added = { restaurants: 0, chabad: 0, groceries: 0 };
  for (const f of allFeatures) {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${f.properties.category}-${Math.round(lat * 10000)}-${Math.round(lon * 10000)}`;
    if (!seen.has(key)) {
      existing.features.push(f);
      seen.add(key);
      added[f.properties.category] = (added[f.properties.category] || 0) + 1;
    }
  }

  console.log(`\nAdded: ${JSON.stringify(added)}`);

  existing.metadata.updated = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));

  console.log(`Total features: ${existing.features.length}`);
}

main();
