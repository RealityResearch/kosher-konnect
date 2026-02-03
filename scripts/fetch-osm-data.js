#!/usr/bin/env node
/**
 * Fetch kosher/Jewish establishment data from OpenStreetMap
 * Uses Overpass API to query for:
 * - Synagogues and Jewish places of worship
 * - Kosher restaurants and food establishments
 * - Kosher grocery stores
 * - Jewish community centers
 * - Mikvahs
 * - Jewish schools
 * - Chabad houses
 * - Judaica shops
 */

const fs = require('fs');
const path = require('path');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// US bounding box (approximate)
const US_BBOX = '24.396308,-125.000000,49.384358,-66.934570';

// Query templates for different categories
const QUERIES = {
  synagogues: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["amenity"="place_of_worship"]["religion"="jewish"](area.usa);
      way["amenity"="place_of_worship"]["religion"="jewish"](area.usa);
      node["building"="synagogue"](area.usa);
      way["building"="synagogue"](area.usa);
    );
    out center;
  `,

  restaurants: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["amenity"="restaurant"]["cuisine"~"kosher",i](area.usa);
      node["amenity"="restaurant"]["diet:kosher"="yes"](area.usa);
      node["amenity"="restaurant"]["kosher"="yes"](area.usa);
      node["amenity"="fast_food"]["cuisine"~"kosher",i](area.usa);
      node["amenity"="fast_food"]["diet:kosher"="yes"](area.usa);
      node["amenity"="cafe"]["diet:kosher"="yes"](area.usa);
      way["amenity"="restaurant"]["cuisine"~"kosher",i](area.usa);
      way["amenity"="restaurant"]["diet:kosher"="yes"](area.usa);
    );
    out center;
  `,

  groceries: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["shop"="supermarket"]["diet:kosher"="yes"](area.usa);
      node["shop"="supermarket"]["kosher"="yes"](area.usa);
      node["shop"="kosher"](area.usa);
      node["shop"="butcher"]["diet:kosher"="yes"](area.usa);
      node["shop"="deli"]["diet:kosher"="yes"](area.usa);
      way["shop"="supermarket"]["diet:kosher"="yes"](area.usa);
      way["shop"="kosher"](area.usa);
    );
    out center;
  `,

  chabad: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["amenity"="place_of_worship"]["name"~"Chabad",i](area.usa);
      way["amenity"="place_of_worship"]["name"~"Chabad",i](area.usa);
      node["name"~"Chabad",i]["amenity"](area.usa);
    );
    out center;
  `,

  mikvahs: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["amenity"="mikveh"](area.usa);
      node["amenity"="mikvah"](area.usa);
      node["building"="mikveh"](area.usa);
      node["name"~"mikvah|mikveh|mikva",i](area.usa);
      way["amenity"="mikveh"](area.usa);
      way["amenity"="mikvah"](area.usa);
    );
    out center;
  `,

  schools: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["amenity"="school"]["religion"="jewish"](area.usa);
      node["amenity"="school"]["name"~"Jewish|Hebrew|Yeshiva|Torah",i](area.usa);
      way["amenity"="school"]["religion"="jewish"](area.usa);
      way["amenity"="school"]["name"~"Jewish|Hebrew|Yeshiva|Torah",i](area.usa);
      node["amenity"="college"]["religion"="jewish"](area.usa);
      node["amenity"="university"]["name"~"Yeshiva",i](area.usa);
    );
    out center;
  `,

  jcc: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["name"~"Jewish Community Center|JCC",i](area.usa);
      way["name"~"Jewish Community Center|JCC",i](area.usa);
      node["amenity"="community_centre"]["name"~"Jewish|JCC",i](area.usa);
    );
    out center;
  `,

  judaica: `
    [out:json][timeout:180];
    area["ISO3166-1"="US"]->.usa;
    (
      node["shop"="judaica"](area.usa);
      node["shop"~"books|gift"]["name"~"judaica|jewish",i](area.usa);
      way["shop"="judaica"](area.usa);
    );
    out center;
  `
};

// Convert OSM element to GeoJSON feature
function osmToFeature(element, category) {
  // Get coordinates (handle both nodes and ways with center)
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

  // Build address
  const addressParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode']
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;

  return {
    type: 'Feature',
    properties: {
      category,
      name,
      address,
      website: tags.website || tags.url || tags['contact:website'] || null,
      phone: tags.phone || tags['contact:phone'] || null,
      osmId: element.id,
      osmType: element.type,
      weight: 1
    },
    geometry: {
      type: 'Point',
      coordinates: [lon, lat]
    }
  };
}

// Fetch data from Overpass API
async function fetchCategory(category, query) {
  console.log(`Fetching ${category}...`);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const features = data.elements
      .map(el => osmToFeature(el, category))
      .filter(f => f !== null);

    console.log(`  Found ${features.length} ${category}`);
    return features;
  } catch (error) {
    console.error(`  Error fetching ${category}: ${error.message}`);
    return [];
  }
}

// Deduplicate features by proximity (within ~50 meters)
function deduplicateFeatures(features) {
  const seen = new Set();
  const unique = [];

  for (const feature of features) {
    const [lon, lat] = feature.geometry.coordinates;
    // Round to ~100m precision for deduplication
    const key = `${feature.properties.category}-${Math.round(lat * 1000)}-${Math.round(lon * 1000)}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(feature);
    }
  }

  return unique;
}

// Main execution
async function main() {
  console.log('=== Fetching OSM Data for Kosher Konnect ===\n');

  const allFeatures = [];

  // Fetch each category with delay to avoid rate limiting
  for (const [category, query] of Object.entries(QUERIES)) {
    const features = await fetchCategory(category, query);
    allFeatures.push(...features);

    // Wait 2 seconds between requests to be nice to the API
    if (Object.keys(QUERIES).indexOf(category) < Object.keys(QUERIES).length - 1) {
      console.log('  Waiting 2s before next request...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Deduplicate
  const uniqueFeatures = deduplicateFeatures(allFeatures);
  console.log(`\nTotal unique features: ${uniqueFeatures.length}`);

  // Print category breakdown
  const byCategory = {};
  for (const f of uniqueFeatures) {
    const cat = f.properties.category;
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  console.log('\nBy category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Create GeoJSON output
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      source: 'OpenStreetMap via Overpass API',
      fetched: new Date().toISOString(),
      license: 'ODbL 1.0 - https://opendatacommons.org/licenses/odbl/'
    },
    features: uniqueFeatures
  };

  // Write output
  const outputPath = path.join(__dirname, '../data/osm-locations.json');
  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`\nWrote ${uniqueFeatures.length} features to ${outputPath}`);
}

main().catch(console.error);
