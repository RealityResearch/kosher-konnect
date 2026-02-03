#!/usr/bin/env node
/**
 * Fetch kosher restaurants using simpler queries with longer timeouts
 */

const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function fetchData(query, timeout = 300) {
  const fullQuery = `[out:json][timeout:${timeout}];\n${query}\nout center;`;

  console.log('Sending query...');
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(fullQuery)}`
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
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
  const name = tags.name || 'Unknown';
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
  console.log('=== Fetching Kosher Restaurants ===\n');

  // Simple query for kosher in US
  const query = `
    area["ISO3166-1"="US"]->.usa;
    (
      nwr["diet:kosher"="yes"](area.usa);
      nwr["kosher"="yes"](area.usa);
      nwr["cuisine"~"kosher",i](area.usa);
    );
  `;

  try {
    const data = await fetchData(query, 300);
    console.log(`Found ${data.elements.length} elements`);

    // Filter and convert
    const features = data.elements
      .filter(el => {
        const tags = el.tags || {};
        // Must be a food establishment
        return tags.amenity === 'restaurant' ||
               tags.amenity === 'fast_food' ||
               tags.amenity === 'cafe' ||
               tags.shop === 'bakery' ||
               tags.shop === 'deli';
      })
      .map(el => osmToFeature(el, 'restaurants'))
      .filter(f => f !== null);

    console.log(`Filtered to ${features.length} restaurants`);

    // Load existing data
    const dataPath = path.join(__dirname, '../data/osm-locations.json');
    const existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Add new restaurants (deduplicate)
    const seen = new Set();
    for (const f of existing.features) {
      if (f.properties.category === 'restaurants') {
        const [lon, lat] = f.geometry.coordinates;
        seen.add(`${Math.round(lat * 10000)}-${Math.round(lon * 10000)}`);
      }
    }

    let added = 0;
    for (const f of features) {
      const [lon, lat] = f.geometry.coordinates;
      const key = `${Math.round(lat * 10000)}-${Math.round(lon * 10000)}`;
      if (!seen.has(key)) {
        existing.features.push(f);
        seen.add(key);
        added++;
      }
    }

    console.log(`Added ${added} new restaurants`);

    existing.metadata.updated = new Date().toISOString();
    fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));

    console.log('Updated osm-locations.json');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
