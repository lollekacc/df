let swedenBoundaryFeature = null;
let swedenContainmentPolygons = [];
  const normalizeBoundaryFeature = (geojson) => {
    const feature = geojson?.type === 'FeatureCollection' ? geojson.features?.[0] : geojson;
    const geometry = feature?.type === 'Feature' ? feature.geometry : feature;

    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
      return null;
    }

    const normalizedFeature = {
      type: 'Feature',
      properties: { id: 'sweden' },
      geometry: geometry.type === 'MultiPolygon'
        ? geometry
        : { type: 'MultiPolygon', coordinates: [geometry.coordinates] },
    };

    swedenContainmentPolygons = normalizedFeature.geometry.coordinates.map((polygon) => {
      const simplifyRing = (ring) => {
        const stride = Math.max(1, Math.floor((ring.length - 1) / 320));
        const simplified = ring.filter((point, index) => index < ring.length - 1 && index % stride === 0);
        simplified.push(simplified[0]);
        return simplified;
      };
      const [outerRing, ...holes] = polygon;
      const longitudes = outerRing.map(([longitude]) => longitude);
      const latitudes = outerRing.map(([, latitude]) => latitude);

      return {
        bounds: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
        outerRing: simplifyRing(outerRing),
        holes: holes.map(simplifyRing),
      };
    });

    return normalizedFeature;
  };

  const ringContainsPoint = (ring, point) => {
    const [x, y] = point;
    let inside = false;

    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const [xi, yi] = ring[index];
      const [xj, yj] = ring[previous];
      const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  };

  const isPointInSweden = (point) => {
    const [longitude, latitude] = point;

    return swedenContainmentPolygons.some(({ bounds, outerRing, holes }) => {
      if (longitude < bounds[0] || latitude < bounds[1] || longitude > bounds[2] || latitude > bounds[3]) {
        return false;
      }

      if (!ringContainsPoint(outerRing, point)) {
        return false;
      }

      return !holes.some((hole) => ringContainsPoint(hole, point));
    });
  };

  const createSeededRandom = (seedText) => {
    let seed = 2166136261;

    for (let index = 0; index < seedText.length; index += 1) {
      seed ^= seedText.charCodeAt(index);
      seed = Math.imul(seed, 16777619);
    }

    return () => {
      seed += 0x6D2B79F5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };

  const weightedCitySeeds = [
    [18.0686, 59.3293, 1.35], [11.9746, 57.7089, 1.18], [13.0038, 55.605, 1.16],
    [17.6389, 59.8586, 0.9], [16.5448, 59.6099, 0.74], [15.2134, 59.2753, 0.74],
    [15.6214, 58.4108, 0.72], [14.1618, 57.7826, 0.68], [12.6945, 56.0465, 0.66],
    [13.191, 55.7047, 0.66], [20.263, 63.8258, 0.7], [22.1567, 65.5848, 0.58],
    [17.3069, 62.3908, 0.58], [17.1413, 60.6749, 0.58], [13.5115, 59.4022, 0.56],
    [12.9401, 57.721, 0.54], [16.1924, 58.5877, 0.52], [18.2948, 57.6348, 0.46],
    [20.2253, 67.8558, 0.34], [18.9553, 69.6492, 0.3], [14.6361, 63.1792, 0.38],
    [21.4794, 65.3172, 0.38], [15.437, 60.4858, 0.36], [12.8568, 56.6745, 0.34],
  ];

  const corridorPairs = [
    [[13.0038, 55.605], [18.0686, 59.3293]],
    [[11.9746, 57.7089], [18.0686, 59.3293]],
    [[18.0686, 59.3293], [17.6389, 59.8586]],
    [[18.0686, 59.3293], [17.3069, 62.3908]],
    [[17.3069, 62.3908], [20.263, 63.8258]],
    [[20.263, 63.8258], [22.1567, 65.5848]],
    [[11.9746, 57.7089], [13.5115, 59.4022]],
    [[13.0038, 55.605], [14.1618, 57.7826]],
  ];

  const operatorProfiles = {
    telia: { seed: 'telia', extent: 1.08, north: 1.06, west: 0.95, qualityBias: 0.06 },
    tele2: { seed: 'tele2', extent: 0.96, north: 0.82, west: 1.04, qualityBias: 0.01 },
    telenor: { seed: 'telenor', extent: 0.98, north: 0.86, west: 1.1, qualityBias: 0.02 },
    tre: { seed: 'tre', extent: 0.82, north: 0.62, west: 0.92, qualityBias: -0.04 },
  };

  const networkProfiles = {
    '4g': { radius: 0.34, count: 9, corridorRadius: 0.2, corridorSteps: 11, northFactor: 0.96, gridStep: 0.22, inclusion: 0.98, baseOpacity: 0.25, qualityBias: 0.13 },
    '4gPlus': { radius: 0.28, count: 7, corridorRadius: 0.16, corridorSteps: 9, northFactor: 0.84, gridStep: 0.24, inclusion: 0.94, baseOpacity: 0.23, qualityBias: 0.08 },
    '5g': { radius: 0.24, count: 6, corridorRadius: 0.13, corridorSteps: 8, northFactor: 0.68, gridStep: 0.26, inclusion: 0.9, baseOpacity: 0.21, qualityBias: 0.02 },
    '5gPlus': { radius: 0.2, count: 4, corridorRadius: 0.1, corridorSteps: 6, northFactor: 0.5, gridStep: 0.28, inclusion: 0.84, baseOpacity: 0.19, qualityBias: -0.04 },
  };

  const createIrregularBlob = (center, radius, random, properties = {}) => {
    const pointCount = 13 + Math.floor(random() * 7);
    const ring = [];
    const latScale = Math.max(0.35, Math.cos(center[1] * Math.PI / 180));

    for (let index = 0; index < pointCount; index += 1) {
      const angle = (Math.PI * 2 * index) / pointCount;
      const wobble = 0.62 + random() * 0.56;
      const lng = center[0] + (Math.cos(angle) * radius * wobble) / latScale;
      const lat = center[1] + Math.sin(angle) * radius * wobble;
      ring.push([Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
    }

    ring.push(ring[0]);

    if (!ring.every((point, index) => index % 3 !== 0 || isPointInSweden(point))) {
      return null;
    }

    return {
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
  };

  const getUrbanInfluence = ([longitude, latitude]) => {
    const latitudeScale = Math.max(0.35, Math.cos(latitude * Math.PI / 180));

    return weightedCitySeeds.reduce((strongest, [cityLongitude, cityLatitude, weight]) => {
      const longitudeDistance = (longitude - cityLongitude) * latitudeScale;
      const latitudeDistance = latitude - cityLatitude;
      const distance = Math.sqrt(longitudeDistance ** 2 + latitudeDistance ** 2);
      const influence = weight * Math.exp(-distance / 1.25);
      return Math.max(strongest, influence);
    }, 0);
  };

  const getMockCoverageQuality = (point, operatorProfile, networkProfile, random, bonus = 0) => {
    const northness = Math.min(1, Math.max(0, (point[1] - 55.2) / 13.8));
    const urbanInfluence = Math.min(1, getUrbanInfluence(point));
    const score = 0.34
      + ((1 - northness) * 0.2)
      + (urbanInfluence * 0.28)
      + operatorProfile.qualityBias
      + networkProfile.qualityBias
      + bonus
      + ((random() - 0.5) * 0.34);

    if (score >= 0.7) {
      return 'excellent';
    }

    if (score >= 0.47) {
      return 'good';
    }

    return 'basic';
  };

  const createNationwideTexture = (features, operatorProfile, networkProfile, random) => {
    const latStep = networkProfile.gridStep;

    for (let latitude = 55.18; latitude <= 69.08; latitude += latStep) {
      const latitudeScale = Math.max(0.35, Math.cos(latitude * Math.PI / 180));
      const lngStep = latStep / latitudeScale;
      const rowOffset = Math.floor((latitude - 55.18) / latStep) % 2 ? lngStep * 0.5 : 0;

      for (let longitude = 10.75 + rowOffset; longitude <= 24.25; longitude += lngStep) {
        const center = [
          longitude + ((random() - 0.5) * lngStep * 0.42),
          latitude + ((random() - 0.5) * latStep * 0.42),
        ];

        if (!isPointInSweden(center)) {
          continue;
        }

        const northness = Math.min(1, Math.max(0, (center[1] - 61.5) / 7.5));
        const northCoverage = 1 - (
          northness
          * (1 - (networkProfile.northFactor * operatorProfile.north))
          * 0.2
        );
        const inclusionChance = Math.min(
          0.998,
          (0.91 + networkProfile.inclusion * operatorProfile.extent * 0.07) * northCoverage,
        );

        if (random() > inclusionChance) {
          continue;
        }

        const quality = getMockCoverageQuality(center, operatorProfile, networkProfile, random);
        const blob = createIrregularBlob(
          center,
          latStep * (0.62 + random() * 0.38),
          random,
          { quality, detail: 'texture', opacity: 0.42 + random() * 0.16 },
        );

        if (blob) {
          features.push(blob);
        }

        if (blob && random() < 0.42) {
          const microCenter = [
            center[0] + ((random() - 0.5) * lngStep * 0.58),
            center[1] + ((random() - 0.5) * latStep * 0.58),
          ];

          if (isPointInSweden(microCenter)) {
            const microBlob = createIrregularBlob(
              microCenter,
              latStep * (0.18 + random() * 0.18),
              random,
              {
                quality: getMockCoverageQuality(microCenter, operatorProfile, networkProfile, random, (random() - 0.5) * 0.16),
                detail: 'texture',
                opacity: 0.5 + random() * 0.16,
              },
            );

            if (microBlob) {
              features.push(microBlob);
            }
          }
        }
      }
    }
  };

  const buildCoverageCollection = (operator, networkKey) => {
    const operatorProfile = operatorProfiles[operator];
    const networkProfile = networkProfiles[networkKey];
    const random = createSeededRandom(`${operatorProfile.seed}-${networkKey}-coverage`);
    const features = [{
      type: 'Feature',
      properties: { quality: 'basic', detail: 'boundary', opacity: networkProfile.baseOpacity },
      geometry: swedenBoundaryFeature.geometry,
    }];

    createNationwideTexture(features, operatorProfile, networkProfile, random);

    weightedCitySeeds.forEach(([lng, lat, weight]) => {
      const northPenalty = lat > 62 ? networkProfile.northFactor * operatorProfile.north : 1;
      const count = Math.max(1, Math.round(networkProfile.count * weight * operatorProfile.extent * northPenalty));

      for (let index = 0; index < count; index += 1) {
        const offset = networkProfile.radius * (0.3 + random() * 1.05);
        const angle = random() * Math.PI * 2;
        const center = [lng + Math.cos(angle) * offset * 1.2, lat + Math.sin(angle) * offset * 0.82];
        const radius = networkProfile.radius * (0.42 + random() * 0.78) * weight * operatorProfile.extent;

        if (!isPointInSweden(center)) {
          continue;
        }

        const blob = createIrregularBlob(center, radius, random, {
          quality: getMockCoverageQuality(center, operatorProfile, networkProfile, random, 0.18),
          detail: 'city',
          opacity: 0.55 + random() * 0.13,
        });

        if (blob) {
          features.push(blob);
        }
      }
    });

    corridorPairs.forEach(([start, end]) => {
      const steps = Math.round(networkProfile.corridorSteps * operatorProfile.extent);

      for (let index = 1; index < steps; index += 1) {
        if (random() < (networkKey === '5gPlus' ? 0.34 : 0.16)) {
          continue;
        }

        const t = index / steps;
        const lng = start[0] + (end[0] - start[0]) * t + (random() - 0.5) * 0.22;
        const lat = start[1] + (end[1] - start[1]) * t + (random() - 0.5) * 0.18;

        if (!isPointInSweden([lng, lat])) {
          continue;
        }

        const point = [lng, lat];
        const blob = createIrregularBlob(point, networkProfile.corridorRadius * (0.72 + random() * 0.7), random, {
          quality: getMockCoverageQuality(point, operatorProfile, networkProfile, random, 0.1),
          detail: 'corridor',
          opacity: 0.5 + random() * 0.12,
        });

        if (blob) {
          features.push(blob);
        }
      }
    });

    return { type: 'FeatureCollection', features };
  };

  const createNightLightSeed = (longitude, latitude, salt = 0) => {
    const x = Math.round((longitude + 180) * 10000);
    const y = Math.round((latitude + 90) * 10000);
    const raw = Math.sin((x * 12.9898) + (y * 78.233) + (salt * 37.719)) * 43758.5453;
    return raw - Math.floor(raw);
  };

  const getLineStrings = (geometry) => {
    if (!geometry) {
      return [];
    }

    if (geometry.type === 'LineString') {
      return [geometry.coordinates];
    }

    if (geometry.type === 'MultiLineString') {
      return geometry.coordinates;
    }

    return [];
  };

  const getPolygonCentroid = (geometry) => {
    const rings = geometry?.type === 'Polygon'
      ? geometry.coordinates
      : geometry?.type === 'MultiPolygon'
        ? geometry.coordinates[0]
        : null;
    const ring = rings?.[0];

    if (!ring?.length) {
      return null;
    }

    const sum = ring.reduce((total, point) => [total[0] + point[0], total[1] + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  };

  const operatorCoverageProfiles = {
    telia: { density: 1.08, urbanBias: 0.14, northReliability: 0.94, salt: 101 },
    tele2: { density: 0.92, urbanBias: 0.36, northReliability: 0.7, salt: 203 },
    telenor: { density: 0.96, urbanBias: 0.28, northReliability: 0.76, salt: 307 },
    tre: { density: 0.8, urbanBias: 0.72, northReliability: 0.5, salt: 409 },
  };

  const networkCoverageProfiles = {
    '4G': { density: 0.95, urbanBoost: 0.18, remotePenalty: 0.12, salt: 4 },
    '4G+': { density: 0.86, urbanBoost: 0.32, remotePenalty: 0.22, salt: 44 },
    '5G': { density: 0.64, urbanBoost: 0.62, remotePenalty: 0.46, salt: 5 },
    '5G+': { density: 0.42, urbanBoost: 0.9, remotePenalty: 0.66, salt: 55 },
  };

  const swedenCityAnchors = [
    [18.0686, 59.3293, 1.2],
    [11.9746, 57.7089, 1],
    [13.0038, 55.605, 0.95],
    [17.6389, 59.8586, 0.82],
    [15.6214, 58.4108, 0.68],
    [16.1924, 58.5877, 0.58],
    [20.263, 63.8258, 0.62],
    [22.1567, 65.5848, 0.46],
    [14.1618, 57.7826, 0.5],
    [12.6945, 56.0465, 0.44],
    [15.2134, 59.2753, 0.5],
    [13.5115, 59.4022, 0.42],
    [18.2948, 57.6348, 0.34],
    [17.3069, 62.3908, 0.36],
  ];

  const getCoverageCityInfluence = (longitude, latitude) => swedenCityAnchors.reduce((strongest, [cityLongitude, cityLatitude, weight]) => {
    const distance = Math.hypot((longitude - cityLongitude) * 0.72, latitude - cityLatitude);
    const influence = weight * Math.exp(-distance / 0.95);
    return Math.max(strongest, influence);
  }, 0);

  const getRoadCoverageFactor = (roadClass) => ({
    motorway: 1.18,
    trunk: 1.14,
    primary: 1.08,
    secondary: 1,
    tertiary: 0.94,
    minor: 0.86,
    service: 0.72,
    track: 0.48,
  }[roadClass] ?? 0.8);

  const clampCoverageValue = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  const getStreetKey = (line, roadClass) => {
    const firstPoint = line[0];
    const middlePoint = line[Math.floor(line.length / 2)];
    const lastPoint = line[line.length - 1];

    return [roadClass, firstPoint, middlePoint, lastPoint]
      .flat()
      .map((value) => typeof value === 'number' ? value.toFixed(5) : value)
      .join('|');
  };

  const getCoverageQuality = (score) => {
    if (score > 1.08) {
      return 'excellent';
    }

    if (score > 0.72) {
      return 'good';
    }

    return 'fair';
  };

  const createStreetCoverageFeature = (coordinates, quality, operator, networkKey, roadClass, strength) => ({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {
      quality,
      operator,
      network: networkKey,
      roadClass,
      strength: Number(strength.toFixed(3)),
    },
  });

  const sampleStreetCoverage = (feature, features, usedKeys, operatorProfile, networkProfile, featureLimit, operator) => {
    const roadClass = feature.properties?.class;
    const roadFactor = getRoadCoverageFactor(roadClass);

    if (roadFactor < 0.48 || features.length >= featureLimit) {
      return;
    }

    for (const line of getLineStrings(feature.geometry)) {
      if (line.length < 2 || features.length >= featureLimit) {
        continue;
      }

      const middlePoint = line[Math.floor(line.length / 2)];
      const [longitude, latitude] = middlePoint;

      if (!isPointInSweden(middlePoint)) {
        continue;
      }

      const streetKey = getStreetKey(line, roadClass);

      if (usedKeys.has(streetKey)) {
        continue;
      }

      usedKeys.add(streetKey);
      const cityInfluence = getCoverageCityInfluence(longitude, latitude);
      const northness = clampCoverageValue((latitude - 60.5) / 8.2, 0, 1);
      const remoteFactor = 1 - (northness * networkProfile.remotePenalty * (1 - operatorProfile.northReliability));
      const coverageStrength = operatorProfile.density
        * networkProfile.density
        * roadFactor
        * remoteFactor
        * (0.78 + cityInfluence * (operatorProfile.urbanBias + networkProfile.urbanBoost + 0.45));
      const combinationSalt = (operatorProfile.salt * 17) + (networkProfile.salt * 31);
      const availabilitySeed = createNightLightSeed(longitude, latitude, combinationSalt + line.length);
      const availabilityThreshold = clampCoverageValue(0.68 + coverageStrength * 0.22, 0.08, 0.98);

      if (availabilitySeed > availabilityThreshold) {
        continue;
      }

      const qualitySeed = createNightLightSeed(longitude, latitude, combinationSalt + 997);
      const qualityStrength = coverageStrength * (0.82 + qualitySeed * 0.36);
      features.push(createStreetCoverageFeature(
        line,
        getCoverageQuality(qualityStrength),
        operator,
        networkProfile.networkKey,
        roadClass,
        qualityStrength,
      ));
    }
  };


const cache = new Map();
let boundary;
const latest = {};
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const ensureBoundary = () => boundary ||= fetch(new URL('./geo/sweden-boundary.geojson', self.location.href))
  .then(response => { if (!response.ok) throw new Error('Boundary unavailable'); return response.json(); })
  .then(data => { swedenBoundaryFeature = normalizeBoundaryFeature(data); if (!swedenBoundaryFeature) throw new Error('Invalid boundary'); })
  .catch(error => { boundary = null; throw error; });
self.onmessage = async ({ data }) => {
  const { kind, id, combinations, roads, zoom } = data;
  latest[kind] = id;
  if (kind === 'cancel') { latest.coverage = id; latest.streets = id; return; }
  try {
    await ensureBoundary();
    const features = [], points = [];
    for (const { operator, network } of combinations) {
      if (latest[kind] !== id) return;
      if (kind === 'coverage') {
        const key = operator + ':' + network;
        if (!cache.has(key)) {
          const collection = buildCoverageCollection(operator, network);
          const texture = collection.features.filter(f => f.properties.detail !== 'boundary').map(f => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: getPolygonCentroid(f.geometry) },
            properties: { ...f.properties, operator, network },
          }));
          cache.set(key, { collection, texture });
        }
        const item = cache.get(key);
        features.push(...item.collection.features);
        points.push(...item.texture);
      } else if (kind === 'streets') {
        const profile = { ...networkCoverageProfiles[({'4g':'4G','4gPlus':'4G+','5g':'5G','5gPlus':'5G+'})[network]], networkKey: network };
        const limit = Math.max(600, Math.floor((zoom < 7 ? 2800 : zoom < 12 ? 4800 : 6800) / combinations.length));
        const selected = [], used = new Set();
        for (let i = 0; i < roads.length; i++) {
          sampleStreetCoverage(roads[i], selected, used, operatorCoverageProfiles[operator], profile, limit, operator);
          if (i % 100 === 99) { await pause(); if (latest[kind] !== id) return; }
        }
        features.push(...selected);
      }
      await pause();
    }
    if (latest[kind] === id) self.postMessage({ kind, id, collection: { type:'FeatureCollection', features }, texture: { type:'FeatureCollection', features: points } });
  } catch (error) {
    if (latest[kind] === id) self.postMessage({ kind, id, error: error.message });
  }
};
