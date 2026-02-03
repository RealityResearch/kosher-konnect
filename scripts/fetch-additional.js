#!/usr/bin/env node
/**
 * Fetch additional data that may have timed out in the main fetch
 */

const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Break up by regions for large queries
const REGIONS = [
  { name: 'Northeast', bbox: '38.5,-82.0,45.5,-66.9' },
  { name: 'Southeast', bbox: '24.4,-92.0,38.5,-75.0' },
  { name: 'Midwest', bbox: '36.0,-104.0,49.4,-80.0' },
  { name: 'Southwest', bbox: '24.4,-125.0,42.0,-102.0' },
  { name: 'West', bbox: '42.0,-125.0,49.4,-102.0' }
];

async function fetchWithRetry(query, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`
      });
      if (response.ok) {
        return await response.json();
      }
      if (i < retries - 1) {
        console.log(`    Retry ${i + 2}/${retries}...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      if (i < retries - 1) {
        console.log(`    Error: ${e.message}, retrying...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  return { elements: [] };
}

function osmToFeature(element, category) {
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
  const name = tags.name || tags['name:en'] || 'Unknown';
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
      osmId: element.id,
      weight: 1
    },
    geometry: {
      type: 'Point',
      coordinates: [lon, lat]
    }
  };
}

async function fetchRestaurants() {
  console.log('Fetching kosher restaurants by region...');
  const allFeatures = [];

  for (const region of REGIONS) {
    console.log(`  ${region.name}...`);
    const query = `
      [out:json][timeout:120][bbox:${region.bbox}];
      (
        node["amenity"="restaurant"]["cuisine"~"kosher",i];
        node["amenity"="restaurant"]["diet:kosher"="yes"];
        node["amenity"="fast_food"]["cuisine"~"kosher",i];
        node["amenity"="cafe"]["diet:kosher"="yes"];
        way["amenity"="restaurant"]["cuisine"~"kosher",i];
        way["amenity"="restaurant"]["diet:kosher"="yes"];
      );
      out center;
    `;

    const data = await fetchWithRetry(query);
    const features = data.elements
      .map(el => osmToFeature(el, 'restaurants'))
      .filter(f => f !== null);
    console.log(`    Found ${features.length}`);
    allFeatures.push(...features);
    await new Promise(r => setTimeout(r, 2000));
  }

  return allFeatures;
}

async function fetchChabad() {
  console.log('Fetching Chabad houses by region...');
  const allFeatures = [];

  for (const region of REGIONS) {
    console.log(`  ${region.name}...`);
    const query = `
      [out:json][timeout:120][bbox:${region.bbox}];
      (
        node["amenity"="place_of_worship"]["name"~"Chabad",i];
        way["amenity"="place_of_worship"]["name"~"Chabad",i];
        node["name"~"Chabad",i]["amenity"];
      );
      out center;
    `;

    const data = await fetchWithRetry(query);
    const features = data.elements
      .map(el => osmToFeature(el, 'chabad'))
      .filter(f => f !== null);
    console.log(`    Found ${features.length}`);
    allFeatures.push(...features);
    await new Promise(r => setTimeout(r, 2000));
  }

  return allFeatures;
}

async function main() {
  console.log('=== Fetching Additional OSM Data ===\n');

  const restaurants = await fetchRestaurants();
  const chabad = await fetchChabad();

  console.log(`\nTotal: ${restaurants.length} restaurants, ${chabad.length} chabad`);

  // Load existing OSM data and merge
  const osmPath = path.join(__dirname, '../data/osm-locations.json');
  const existing = JSON.parse(fs.readFileSync(osmPath, 'utf-8'));

  // Filter out old restaurants/chabad and add new ones
  const filtered = existing.features.filter(
    f => f.properties.category !== 'restaurants' && f.properties.category !== 'chabad'
  );
  const merged = [...filtered, ...restaurants, ...chabad];

  // Deduplicate
  const seen = new Set();
  const unique = merged.filter(f => {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${f.properties.category}-${Math.round(lat * 1000)}-${Math.round(lon * 1000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  existing.features = unique;
  existing.metadata.updated = new Date().toISOString();

  fs.writeFileSync(osmPath, JSON.stringify(existing, null, 2));
  console.log(`\nUpdated ${osmPath} with ${unique.length} total features`);

  // Print breakdown
  const byCategory = {};
  for (const f of unique) {
    const cat = f.properties.category;
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  console.log('\nBy category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch(console.error);
