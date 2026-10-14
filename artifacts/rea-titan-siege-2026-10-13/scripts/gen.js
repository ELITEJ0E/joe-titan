/* Titan Siege — voxel world generator.
   Shared by the main thread (classic script) and Web Workers.
   The world: a walled district (towers, gate, rooftops, plaza, training yard) in the middle of
   open fields, forests of giant trees, watchtowers and supply depots, ringed by distant mountains. */
var CS = 16, CH = 128, SEA = 40;
var B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, PLANKS: 8, COBBLE: 9,
  GLASS: 10, BRICK: 11, SNOW: 12, COAL: 13, IRON: 14, GOLD: 15, DIAMOND: 16, BEDROCK: 17, CACTUS: 18,
  SANDSTONE: 19, GRAVEL: 20, SPRUCE_LOG: 21, SPRUCE_LEAVES: 22, TALLGRASS: 23, ROSE: 24, DANDELION: 25,
  SNOW_BLOCK: 26, ICE: 27,
  STONEBRICK: 28, PLASTER: 29, TIMBER: 30, ROOF_RED: 31, ROOF_SLATE: 32, CANOPY: 33, CANOPY_LIGHT: 34,
  BARK: 35, PATH: 36, BANNER: 37, CRATE: 38, MOSSY: 39, HAY: 40, IRONBARS: 41, DIRT_PATH: 42, WINDOW: 43
};
var BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, SNOWY: 5, MOUNTAINS: 6, DISTRICT: 7 };
var BIOME_NAMES = ['Lake', 'Shore', 'Open Fields', 'Giant Forest', 'Desert', 'Snow', 'Mountains', 'Haverwall District'];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---- Simplex noise (after Stefan Gustavson) ---- */
var GRAD3 = new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);
var F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
function Simplex(rand) {
  var p = new Uint8Array(256), i;
  for (i = 0; i < 256; i++) p[i] = i;
  for (i = 255; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = p[i]; p[i] = p[j]; p[j] = t; }
  this.perm = new Uint8Array(512); this.pm = new Uint8Array(512);
  for (i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.pm[i] = (this.perm[i] % 12) * 3; }
  this.ox = rand() * 4096; this.oy = rand() * 4096; this.oz = rand() * 4096;
}
Simplex.prototype.noise2 = function (xin, yin) {
  var perm = this.perm, pm = this.pm, n0 = 0, n1 = 0, n2 = 0;
  var s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
  var t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
  var i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  var ii = i & 255, jj = j & 255, g;
  var t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) { g = pm[ii + perm[jj]]; t0 *= t0; n0 = t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0); }
  var t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) { g = pm[ii + i1 + perm[jj + j1]]; t1 *= t1; n1 = t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1); }
  var t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) { g = pm[ii + 1 + perm[jj + 1]]; t2 *= t2; n2 = t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2); }
  return 70 * (n0 + n1 + n2);
};
function fbm2(n, x, z, oct) {
  var a = 1, f = 1, s = 0, t = 0;
  x += n.ox; z += n.oy;
  for (var o = 0; o < oct; o++) { s += a * n.noise2(x * f + o * 31.7, z * f - o * 17.3); t += a; a *= 0.5; f *= 2.03; }
  return s / t;
}
function smoothstep(a, b, x) { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }

var G = {}, SEED = 0, TREE_CACHE = null;
function initGen(seed) {
  SEED = seed >>> 0;
  var r = mulberry32(SEED);
  ['cont', 'det', 'ero', 'ridge', 'temp', 'moist', 'cave1', 'cave2', 'cave3', 'sea'].forEach(function (k) { G[k] = new Simplex(r); });
  TREE_CACHE = new Map();
  SCACHE = new Map();
}
function hash2(x, z, s) {
  var h = SEED ^ Math.imul(s | 0, 0x27d4eb2d);
  h = Math.imul(h ^ x, 0x85ebca6b); h = (h << 13) | (h >>> 19);
  h = Math.imul(h ^ z, 0xc2b2ae35); h = (h << 17) | (h >>> 15);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z, s) {
  var h = SEED ^ Math.imul(s | 0, 0x27d4eb2d);
  h = Math.imul(h ^ x, 0x85ebca6b); h = (h << 13) | (h >>> 19);
  h = Math.imul(h ^ y, 0xcc9e2d51); h = (h << 15) | (h >>> 17);
  h = Math.imul(h ^ z, 0xc2b2ae35); h = (h << 17) | (h >>> 15);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/* =====================================================================
   World layout constants (shared with the game)
   ===================================================================== */
var GROUND = 46;                 // district ground level (top grass block y)
var DR = 76;                     // district half size (outer face of the wall)
var WALL_T = 4;
var WALL_TOP = GROUND + 22;      // walkway y on top of the wall
var GATE_HW = 5;                 // half width of the south gate
var RING_IN = 65;                // ring road inside the wall starts here
var YARD = { x0: 18, x1: 62, z0: -62, z1: -18 };   // training yard (inside, north-east)
var POLES = [[26, -26, 24], [54, -26, 22], [26, -54, 23], [54, -54, 25], [40, -40, 30], [40, -22, 18], [62, -40, 20]];
var TOWERS = [];
(function () {
  var c = DR - 2;
  // corner towers with slate pyramid roofs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { TOWERS.push({ x: s[0] * c, z: s[1] * c, hw: 7, top: GROUND + 34, roof: B.ROOF_SLATE, flat: false }); });
  // wall towers with battlements
  TOWERS.push({ x: -c, z: 0, hw: 5, top: GROUND + 29, roof: 0, flat: true });
  TOWERS.push({ x: c, z: 0, hw: 5, top: GROUND + 29, roof: 0, flat: true });
  TOWERS.push({ x: 0, z: -c, hw: 5, top: GROUND + 29, roof: 0, flat: true });
  // gate towers
  TOWERS.push({ x: -11, z: c, hw: 5, top: GROUND + 31, roof: B.ROOF_RED, flat: false });
  TOWERS.push({ x: 11, z: c, hw: 5, top: GROUND + 31, roof: B.ROOF_RED, flat: false });
  // bell tower in the plaza
  TOWERS.push({ x: 0, z: 0, hw: 4, top: GROUND + 40, roof: B.ROOF_RED, flat: false, bell: true });
})();
var SUPPLY = [
  { x: 9, z: 9, name: 'Plaza Depot' },
  { x: 22, z: DR - 2, wall: true, name: 'Gate Wall Depot' },
  { x: 0, z: -132, name: 'Forest Outpost' },
  { x: -150, z: 26, name: 'West Field Depot' },
  { x: 140, z: -24, name: 'East Field Depot' },
  { x: 59, z: -21, name: 'Training Yard Depot' }
];

/* ---- terrain height (no structures) ---- */
function groundH(x, z) {
  var r = Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5));
  var flat = smoothstep(DR + 6, DR + 44, r);
  var h = GROUND;
  if (flat > 0) {
    var hills = fbm2(G.cont, x * 0.0055, z * 0.0055, 4) * 10 + fbm2(G.det, x * 0.03, z * 0.03, 2) * 1.4;
    // the titan road south of the gate stays fairly level
    var road = Math.abs(x) < 26 && z > 0 ? 0.35 : 1;
    h += hills * flat * road;
  }
  var d = Math.sqrt(x * x + z * z);
  var m = smoothstep(330, 460, d);
  if (m > 0) {
    var rid = 1 - Math.abs(fbm2(G.ridge, x * 0.009, z * 0.009, 4) * 1.6); if (rid < 0) rid = 0;
    h += m * (16 + rid * rid * 50);
  }
  h = Math.floor(h);
  if (h < 8) h = 8; if (h > CH - 12) h = CH - 12;
  return h;
}
function forestAt(x, z) {
  var r = Math.max(Math.abs(x), Math.abs(z));
  if (r < DR + 30) return 0;
  if (z > DR && Math.abs(x) < 46) return 0;              // keep the southern approach open
  if (z < -112 && z > -340 && Math.abs(x) < 250) return 1;  // the Great Forest, north of the walls
  return fbm2(G.moist, x * 0.0042, z * 0.0042, 3) > 0.12 ? 1 : 0;
}

/* ---- district helpers ---- */
function towerAt(x, z) {
  for (var i = 0; i < TOWERS.length; i++) {
    var t = TOWERS[i], dx = Math.abs(x + 0.5 - t.x), dz = Math.abs(z + 0.5 - t.z);
    var reach = t.hw + (t.flat ? 0 : 1);
    if (dx < reach && dz < reach) return t;
  }
  return null;
}
function inYard(x, z) { return x >= YARD.x0 && x <= YARD.x1 && z >= YARD.z0 && z <= YARD.z1; }
function isStreet(x, z) {
  var ax = Math.abs(x + 0.5), az = Math.abs(z + 0.5), r = Math.max(ax, az);
  if (r >= RING_IN) return true;                       // ring road along the wall
  if (ax < 4 && z > 0) return true;                    // main avenue from the gate
  if (ax < 3 && z < 0) return true;                    // north avenue
  if (az < 3.5) return true;                           // cross street
  if (x * x + z * z < 17 * 17) return true;           // plaza
  return false;
}
function lotArea(x, z) { return !isStreet(x, z) && !inYard(x, z); }
var LOT = 12, LOT_OFF = 600;
var HOUSE = { ok: false, u0: 0, u1: 0, v0: 0, v1: 0, top: 0, axisX: true, roof: 0, chimney: false, wallMat: 0 };
function houseFor(li, lj) {
  // computes the house occupying lot (li, lj); results in HOUSE
  var h1 = hash2(li, lj, 51), h2 = hash2(li, lj, 52), h3 = hash2(li, lj, 53), h4 = hash2(li, lj, 54);
  var bx = li * LOT - LOT_OFF, bz = lj * LOT - LOT_OFF;
  HOUSE.ok = false;
  if (h1 < 0.07) return HOUSE;  // garden lot
  HOUSE.u0 = 1 + (h2 < 0.5 ? 0 : 1); HOUSE.u1 = LOT - 2 - (h3 < 0.5 ? 0 : 1);
  HOUSE.v0 = 1 + (h3 < 0.3 ? 1 : 0); HOUSE.v1 = LOT - 2 - (h2 < 0.7 ? 0 : 1);
  // the whole roof footprint must be on buildable ground
  var xa = bx + HOUSE.u0 - 1, xb = bx + HOUSE.u1 + 1, za = bz + HOUSE.v0 - 1, zb = bz + HOUSE.v1 + 1;
  if (!lotArea(xa, za) || !lotArea(xb, za) || !lotArea(xa, zb) || !lotArea(xb, zb)) return HOUSE;
  if (!lotArea((xa + xb) >> 1, za) || !lotArea((xa + xb) >> 1, zb) || !lotArea(xa, (za + zb) >> 1) || !lotArea(xb, (za + zb) >> 1)) return HOUSE;
  var stories = 2 + Math.floor(h4 * 3);
  if (hash2(li, lj, 55) < 0.14) stories = 5 + Math.floor(hash2(li, lj, 56) * 2);
  // houses get a bit taller towards the plaza
  var dc = Math.sqrt((bx + 6) * (bx + 6) + (bz + 6) * (bz + 6));
  if (dc < 40 && stories < 4) stories++;
  HOUSE.top = GROUND + stories * 4;
  HOUSE.axisX = (HOUSE.u1 - HOUSE.u0) >= (HOUSE.v1 - HOUSE.v0);
  HOUSE.roof = hash2(li, lj, 57) < 0.62 ? B.ROOF_RED : B.ROOF_SLATE;
  HOUSE.chimney = hash2(li, lj, 58) < 0.4;
  HOUSE.wallMat = hash2(li, lj, 59) < 0.8 ? B.PLASTER : B.BRICK;
  HOUSE.ok = true;
  return HOUSE;
}
function houseRoofY(u, v) {
  var H = HOUSE, half, dist;
  if (H.axisX) { half = (H.v1 - H.v0) / 2 + 1; dist = Math.abs(v - (H.v0 + H.v1) / 2); }
  else { half = (H.u1 - H.u0) / 2 + 1; dist = Math.abs(u - (H.u0 + H.u1) / 2); }
  return H.top + 1 + Math.max(0, Math.floor(half - dist - 0.01));
}

/* ---- giant trees ---- */
var TCELL = 30;
function giantTree(gx, gz) {
  var key = (gx + 5000) * 10000 + (gz + 5000);
  if (TREE_CACHE.has(key)) return TREE_CACHE.get(key);
  var t = null;
  var px = gx * TCELL + 5 + Math.floor(hash2(gx, gz, 41) * (TCELL - 10));
  var pz = gz * TCELL + 5 + Math.floor(hash2(gx, gz, 42) * (TCELL - 10));
  var f = forestAt(px, pz), r = Math.max(Math.abs(px), Math.abs(pz));
  var p = f ? 0.84 : 0.05;
  if (r < DR + 26 || (pz > DR && Math.abs(px) < 30)) p = 0;
  var d = Math.sqrt(px * px + pz * pz);
  if (d > 420) p = 0;
  if (hash2(gx, gz, 43) < p) {
    var base = groundH(px, pz);
    if (base > SEA) {
      var rt = 2.3 + hash2(gx, gz, 44) * 1.5;
      var th = Math.min(40 + Math.floor(hash2(gx, gz, 45) * 28), CH - 14 - base);
      var br = [], blobs = [];
      var nb = 4 + Math.floor(hash2(gx, gz, 46) * 4), a0 = hash2(gx, gz, 47) * 6.283;
      for (var i = 0; i < nb; i++) {
        var a = a0 + i * 2.39996 + (hash2(gx + i, gz, 48) - 0.5) * 0.6;
        var sy = base + th * (0.42 + 0.5 * i / nb) + hash2(gx, gz + i, 49) * 3;
        var len = 7 + hash2(gx + i, gz - i, 50) * 7, rise = 3 + hash2(gx - i, gz + i, 61) * 6;
        var ex = px + 0.5 + Math.cos(a) * len, ez = pz + 0.5 + Math.sin(a) * len, ey = sy + rise;
        br.push([px + 0.5, sy, pz + 0.5, ex, ey, ez, 1.35]);
        var rb = 4.2 + hash2(gx + i, gz + i, 62) * 2.6;
        blobs.push([ex, ey + 1.2, ez, rb, rb * 0.62, i & 1 ? B.CANOPY_LIGHT : B.CANOPY]);
      }
      // roots
      for (var k = 0; k < 4; k++) {
        var ra = a0 + k * 1.5708 + 0.5;
        br.push([px + 0.5, base + 5, pz + 0.5, px + 0.5 + Math.cos(ra) * (rt + 4), base - 1, pz + 0.5 + Math.sin(ra) * (rt + 4), 1.25]);
      }
      blobs.push([px + 0.5, base + th + 1, pz + 0.5, 7.5, 5, B.CANOPY]);
      t = { x: px, z: pz, base: base, rt: rt, th: th, br: br, blobs: blobs };
    }
  }
  TREE_CACHE.set(key, t);
  return t;
}

/* ---- field watchtowers / ruins ---- */
var WCELL = 64;
function watchtower(gx, gz) {
  var px = gx * WCELL + 16 + Math.floor(hash2(gx, gz, 71) * (WCELL - 32));
  var pz = gz * WCELL + 16 + Math.floor(hash2(gx, gz, 72) * (WCELL - 32));
  var r = Math.max(Math.abs(px), Math.abs(pz));
  if (r < DR + 34 || forestAt(px, pz) || Math.abs(px) < 8 || Math.sqrt(px * px + pz * pz) > 330) return null;
  if (hash2(gx, gz, 73) > 0.42) return null;
  return { x: px, z: pz, h: 20 + Math.floor(hash2(gx, gz, 74) * 16), ruin: hash2(gx, gz, 75) < 0.45 };
}

/* ---- outer ward: field structures to anchor on (spires, cottages, arches, scaffolds, ruined walls) ---- */
var SCELL = 26, SCACHE = null;
var STYPES = ['spire', 'cottage', 'arch', 'scaffold', 'ruin'];
function outwork(gx, gz) {
  var key = (gx + 5000) * 10000 + (gz + 5000);
  if (SCACHE.has(key)) return SCACHE.get(key);
  var s = null;
  var cx = gx * SCELL + 13 + Math.floor((hash2(gx, gz, 304) - 0.5) * 6), cz = gz * SCELL + 13 + Math.floor((hash2(gx, gz, 305) - 0.5) * 6);
  var r = Math.max(Math.abs(cx), Math.abs(cz)), d = Math.sqrt(cx * cx + cz * cz);
  var dens = r < DR + 110 || (cz > DR && Math.abs(cx) < 130) ? 0.94 : 0.7;
  var ok = r > DR + 16 && d < 300 && hash2(gx, gz, 301) < dens;
  if (ok && forestAt(cx, cz) && hash2(gx, gz, 302) > 0.3) ok = false;
  if (ok && groundH(cx, cz) <= SEA + 1) ok = false;
  if (ok) {
    var k = hash2(gx, gz, 303), ax = hash2(gx, gz, 306) < 0.5;
    var type = k < 0.34 ? 'spire' : k < 0.56 ? 'cottage' : k < 0.71 ? 'arch' : k < 0.86 ? 'scaffold' : 'ruin';
    // the titan road south of the gate: tall pillars and arches flank it so scouts can fight there
    if (cz > DR && Math.abs(cx) < 46 && type === 'cottage') type = 'spire';
    s = { type: type, x: cx, z: cz, base: groundH(cx, cz), ax: ax, mat: hash2(gx, gz, 307) < 0.5 ? B.STONEBRICK : B.COBBLE };
    var big = hash2(gx, gz, 308);
    if (type === 'spire') { s.rad = big < 0.35 ? 2 : 1; s.h = 22 + Math.floor(hash2(gx, gz, 309) * (s.rad > 1 ? 26 : 18)); s.plat = s.rad > 1 ? 4 : 3; s.hx = s.hz = s.plat; }
    else if (type === 'cottage') { s.hx = ax ? 5 : 4; s.hz = ax ? 4 : 5; s.st = 1 + Math.floor(big * 2.4); s.h = s.st * 4; s.roof = hash2(gx, gz, 310) < 0.6 ? B.ROOF_RED : B.ROOF_SLATE; s.wall = hash2(gx, gz, 311) < 0.7 ? B.PLASTER : B.BRICK; }
    else if (type === 'arch') { s.L = 6 + Math.floor(big * 4); s.h = 14 + Math.floor(hash2(gx, gz, 309) * 12); s.hx = ax ? s.L + 1 : 1; s.hz = ax ? 1 : s.L + 1; }
    else if (type === 'scaffold') { s.hx = s.hz = 3; s.h = 20 + Math.floor(big * 14); }
    else { s.L = 6 + Math.floor(big * 4); s.h = 7 + Math.floor(hash2(gx, gz, 309) * 9); s.hx = ax ? s.L : 1; s.hz = ax ? 1 : s.L; }
    // keep the road surface itself clear, and don't crowd watchtowers or giant trees
    if (s.z + s.hz > DR && Math.abs(s.x) - s.hx < 7 && s.z - s.hz < DR + 262) s = null;
    if (s) { var wt = watchtower(Math.floor(s.x / WCELL), Math.floor(s.z / WCELL)); if (wt && Math.abs(wt.x - s.x) < s.hx + 8 && Math.abs(wt.z - s.z) < s.hz + 8) s = null; }
    if (s) { var tgx = Math.floor(s.x / TCELL), tgz = Math.floor(s.z / TCELL); for (var j = tgz - 1; j <= tgz + 1 && s; j++) for (var i = tgx - 1; i <= tgx + 1 && s; i++) { var tr = giantTree(i, j); if (tr && Math.abs(tr.x - s.x) < s.hx + 14 && Math.abs(tr.z - s.z) < s.hz + 14) s = null; } }
  }
  SCACHE.set(key, s);
  return s;
}
function outworkAt(x, z) {
  var gx = Math.floor(x / SCELL), gz = Math.floor(z / SCELL);
  for (var j = gz - 1; j <= gz + 1; j++) for (var i = gx - 1; i <= gx + 1; i++) {
    var s = outwork(i, j);
    if (s && Math.abs(x + 0.5 - s.x - 0.5) <= s.hx + 0.01 && Math.abs(z + 0.5 - s.z - 0.5) <= s.hz + 0.01) return s;
  }
  return null;
}
function stoneMix(x, y, z, mat) { var q = hash3(x, y, z, 312); return q < 0.18 ? B.MOSSY : q < 0.3 ? (mat === B.COBBLE ? B.STONEBRICK : B.COBBLE) : mat; }
function outworkColumn(bl, base, x, z, h, s) {
  var y, dx = x - s.x, dz = z - s.z, adx = Math.abs(dx), adz = Math.abs(dz), b = s.base;
  var put = function (yy, id) { if (yy > 0 && yy < CH) bl[(yy << 8) | base] = id; };
  var fill = function (y0, y1, id) { for (var yy = y0; yy <= y1; yy++) put(yy, id === -1 ? stoneMix(x, yy, z, s.mat) : id); };
  if (s.type === 'spire') {
    var top = b + s.h;
    if (adx <= s.rad && adz <= s.rad) { fill(Math.min(h, b) - 2, top, -1); }
    else if (adx <= s.rad + 1 && adz <= s.rad + 1 && hash2(x, z, 313) < 0.5) fill(h + 1, b + 2 + Math.floor(hash2(x, z, 314) * 4), -1);   // rubble skirt
    if (adx <= s.plat && adz <= s.plat) {
      put(top + 1, B.PLANKS);
      if (adx === s.plat || adz === s.plat) { if (((x + z) & 1) === 0) put(top + 2, s.mat); }
      else if (adx <= 1 && adz <= 1 && s.rad < 2 && dx === 1 && dz === -1) put(top + 2, B.CRATE);
      // mid-height ledge on the tall ones
      if (s.h > 32 && adx <= s.rad + 2 && adz <= s.rad + 2) put(b + Math.floor(s.h * 0.55), B.STONEBRICK);
    }
    return;
  }
  if (s.type === 'cottage') {
    var u = adx, v = adz, wallTop = b + s.h, edge = u === s.hx || v === s.hz, inner = u < s.hx && v < s.hz;
    // foundation down to the terrain
    fill(Math.min(h, b) - 1, b, B.COBBLE);
    if (edge) {
      for (y = b + 1; y <= wallTop; y++) {
        var corner = u === s.hx && v === s.hz;
        var lvl = (y - b - 1) % 4;
        var win = !corner && lvl >= 1 && lvl <= 2 && ((s.hx > s.hz ? dx : dz) & 1) === 0 && (s.hx > s.hz ? u < s.hx : v < s.hz);
        var door = !corner && y <= b + 2 && (s.hx > s.hz ? (v === s.hz && dx === 0) : (u === s.hx && dz === 0));
        put(y, door ? B.AIR : win ? B.WINDOW : corner || lvl === 3 ? B.TIMBER : s.wall);
      }
    } else if (inner) { for (y = b + 4; y < wallTop; y += 4) put(y, B.PLANKS); }
    // gable roof
    var half = (s.hx > s.hz ? s.hz : s.hx) + 1, dist = s.hx > s.hz ? adz : adx;
    if (u <= s.hx + 1 && v <= s.hz + 1) {
      var ry = wallTop + 1 + Math.max(0, half - dist - 1);
      put(ry, s.roof);
      if (dist < half - 1 && (u === s.hx || v === s.hz) && (s.hx > s.hz ? u === s.hx : v === s.hz)) for (y = wallTop + 1; y < ry; y++) put(y, s.wall);
    }
    return;
  }
  if (s.type === 'arch') {
    var along = s.ax ? dx : dz, across = s.ax ? adz : adx, top2 = b + s.h, a = Math.abs(along);
    if (a >= s.L - 1 && across <= 1) fill(Math.min(h, b) - 2, top2, -1);                  // the two piers
    if (across <= 1) {
      // deck with a parapet, and a curved soffit under it
      fill(top2 - 1, top2, -1);
      var soff = top2 - 2 - Math.floor(Math.sqrt(Math.max(0, (s.L - 1) * (s.L - 1) - along * along)) * 0.55);
      if (a < s.L - 1) fill(soff, top2 - 2, -1);
      if (across === 1 && ((along & 1) === 0)) put(top2 + 1, s.mat);
    }
    return;
  }
  if (s.type === 'scaffold') {
    var topS = b + s.h, post = adx === 3 && adz === 3, rim = adx === 3 || adz === 3;
    if (post) fill(Math.min(h, b), topS, B.LOG);
    for (y = b + 6; y < topS; y += 6) {
      if (rim) put(y, B.TIMBER);
      else if ((y - b) % 12 === 0) put(y, B.PLANKS);           // landing platforms inside
      if (rim && !post && y + 3 < topS && ((dx + dz + y) % 3 === 0)) put(y + 3, B.TIMBER);  // cross braces
    }
    put(topS, B.PLANKS);
    if (rim && ((x + z) & 1) === 0) put(topS + 1, B.TIMBER);
    if (adx <= 1 && adz <= 1) put(topS + 1 + (adx + adz === 0 ? 1 : 0), adx + adz === 0 ? B.BANNER : B.AIR);
    return;
  }
  // ruined wall: jagged top, a few broken windows
  var al = s.ax ? dx : dz, top3 = b + s.h - Math.floor(hash2(Math.floor(al / 2), s.z, 315) * 6) - (Math.abs(al) > s.L - 2 ? 3 : 0);
  for (y = Math.min(h, b) - 1; y <= top3; y++) {
    var gap = (y - b) > 2 && (y - b) < 6 && ((al + 100) % 5 === 2);
    if (!gap) put(y, stoneMix(x, y, z, s.mat));
  }
}

/* =====================================================================
   Chunk generation
   ===================================================================== */
function generateChunk(cx, cz) {
  var blocks = new Uint8Array(CS * CS * CH);
  var biomes = new Uint8Array(CS * CS);
  var x0 = cx * CS, z0 = cz * CS, x, y, z;
  for (z = 0; z < CS; z++) for (x = 0; x < CS; x++) {
    var wx = x0 + x, wz = z0 + z, base = (z << 4) | x;
    var h = groundH(wx, wz);
    var ax = Math.abs(wx + 0.5), az = Math.abs(wz + 0.5), r = Math.max(ax, az);
    var inside = r < DR + 3;
    var forest = forestAt(wx, wz);
    biomes[z * CS + x] = inside ? BIOME.DISTRICT : forest ? BIOME.FOREST : (h <= SEA ? BIOME.OCEAN : BIOME.PLAINS);
    var mtn = h > GROUND + 30;
    for (y = 0; y <= h; y++) {
      var id;
      if (y === 0) id = B.BEDROCK;
      else if (y < h - 3) id = B.STONE;
      else if (y < h) id = mtn ? B.STONE : B.DIRT;
      else id = mtn ? (h > GROUND + 58 ? B.SNOW_BLOCK : B.STONE) : (h <= SEA ? B.SAND : B.GRASS);
      blocks[(y << 8) | base] = id;
    }
    if (h < SEA) for (y = h + 1; y <= SEA; y++) blocks[(y << 8) | base] = B.WATER;
    if (inside) districtColumn(blocks, base, wx, wz, h);
    else fieldColumn(blocks, base, wx, wz, h, forest);
  }
  placeGiantTrees(blocks, x0, z0);
  placeSupply(blocks, x0, z0);
  var maxY = 0;
  for (var i = blocks.length - 1; i >= 0; i--) if (blocks[i]) { maxY = i >> 8; break; }
  return { blocks: blocks, biomes: biomes, maxY: maxY };
}

function districtColumn(bl, base, x, z, h) {
  var ax = Math.abs(x + 0.5), az = Math.abs(z + 0.5), r = Math.max(ax, az), y;
  var t = towerAt(x, z);
  if (t) { towerColumn(bl, base, x, z, t); return; }
  if (r >= DR - WALL_T) {
    // outer buttresses
    var along = ax > az ? z : x;
    if (r >= DR) {
      if (r < DR + 2 && ((along % 16) + 16) % 16 < 3 && !(z > 0 && az > ax && ax < GATE_HW + 3)) {
        for (y = GROUND + 1; y <= WALL_TOP - 3 - Math.floor((r - DR) * 2); y++) bl[(y << 8) | base] = B.STONEBRICK;
      }
      if (z > DR && ax < 4) bl[(GROUND << 8) | base] = B.DIRT_PATH;
      return;
    }
    var gateTop = 0;
    if (z > 0 && az >= ax && ax < GATE_HW) gateTop = GROUND + (ax < 2.5 ? 13 : ax < 3.5 ? 12 : ax < 4.5 ? 11 : 9);
    for (y = GROUND + 1; y <= WALL_TOP; y++) {
      if (y <= gateTop) { if (y === gateTop && (Math.floor(ax) & 1) === 0) bl[(y << 8) | base] = B.IRONBARS; continue; }
      var hv = hash3(x, y, z, 81);
      bl[(y << 8) | base] = (y < GROUND + 4 && hv < 0.45) || hv < 0.07 ? B.MOSSY : B.STONEBRICK;
    }
    if (gateTop) bl[(GROUND << 8) | base] = B.PATH;
    // battlements on the outer edge, low parapet on the inner edge
    var s = ((along % 4) + 4) % 4;
    if (r >= DR - 1 && s < 2) bl[((WALL_TOP + 1) << 8) | base] = B.STONEBRICK;
    if (r >= DR - 1 && s < 2 && ((along % 32) + 32) % 32 < 2) bl[((WALL_TOP + 2) << 8) | base] = B.STONEBRICK;
    // banners hanging on the inner face of the wall every 24 blocks
    if (r < DR - WALL_T + 1 && ((along % 24) + 24) % 24 < 3) {
      for (y = WALL_TOP - 10; y <= WALL_TOP - 1; y++) bl[(y << 8) | base] = B.BANNER;
    }
    return;
  }
  // ---- inside the district ----
  if (isStreet(x, z)) {
    var d2 = x * x + z * z;
    var plazaRing = d2 < 17 * 17 && d2 > 15 * 15;
    bl[(GROUND << 8) | base] = plazaRing ? B.STONEBRICK : (hash2(x, z, 82) < 0.22 ? B.GRAVEL : B.PATH);
    // fountain basin in the plaza around the bell tower
    return;
  }
  if (inYard(x, z)) {
    bl[(GROUND << 8) | base] = hash2(x >> 1, z >> 1, 83) < 0.82 ? B.DIRT_PATH : B.GRAVEL;
    var edge = x === YARD.x0 || x === YARD.x1 || z === YARD.z0 || z === YARD.z1;
    if (edge) { bl[((GROUND + 1) << 8) | base] = B.TIMBER; if (((x + z) & 3) === 0) bl[((GROUND + 2) << 8) | base] = B.TIMBER; }
    for (var p = 0; p < POLES.length; p++) {
      var P = POLES[p];
      if (x >= P[0] && x <= P[0] + 1 && z >= P[1] && z <= P[1] + 1) {
        for (y = GROUND + 1; y <= GROUND + P[2]; y++) bl[(y << 8) | base] = B.LOG;
        bl[((GROUND + P[2] + 1) << 8) | base] = B.PLANKS;
      }
    }
    return;
  }
  // house lots
  var li = Math.floor((x + LOT_OFF) / LOT), lj = Math.floor((z + LOT_OFF) / LOT);
  var u = x + LOT_OFF - li * LOT, v = z + LOT_OFF - lj * LOT;
  var H = houseFor(li, lj);
  bl[(GROUND << 8) | base] = hash2(x, z, 84) < 0.5 ? B.PATH : B.GRAVEL;
  if (!H.ok) {
    // garden: grass, a hay bale or a small tree
    bl[(GROUND << 8) | base] = B.GRASS;
    if (u === 6 && v === 6) { for (y = GROUND + 1; y <= GROUND + 4; y++) bl[(y << 8) | base] = B.LOG; }
    else if (Math.abs(u - 6) <= 2 && Math.abs(v - 6) <= 2 && !(Math.abs(u - 6) === 2 && Math.abs(v - 6) === 2)) {
      for (y = GROUND + 4; y <= GROUND + 6; y++) bl[(y << 8) | base] = B.LEAVES;
    } else if (hash2(x, z, 85) < 0.2) bl[((GROUND + 1) << 8) | base] = B.TALLGRASS;
    return;
  }
  var inWall = u >= H.u0 && u <= H.u1 && v >= H.v0 && v <= H.v1;
  var inRoof = u >= H.u0 - 1 && u <= H.u1 + 1 && v >= H.v0 - 1 && v <= H.v1 + 1;
  if (!inRoof) return;
  var roofY = houseRoofY(u, v);
  if (inWall) {
    var perim = u === H.u0 || u === H.u1 || v === H.v0 || v === H.v1;
    var corner = (u === H.u0 || u === H.u1) && (v === H.v0 || v === H.v1);
    var alongW = (u === H.u0 || u === H.u1) ? v : u;
    var front = v === H.v1 && u === ((H.u0 + H.u1) >> 1);
    for (y = GROUND + 1; y <= H.top; y++) {
      var id;
      if (!perim) id = B.PLANKS;
      else {
        var ly = (y - GROUND) % 4;
        if (corner) id = B.TIMBER;
        else if (ly === 0) id = B.TIMBER;
        else if (front && y <= GROUND + 2) id = B.TIMBER;
        else if ((ly === 2 || ly === 3) && (alongW % 3) === 1) id = B.WINDOW;
        else id = H.wallMat;
      }
      bl[(y << 8) | base] = id;
    }
    var gable = H.axisX ? (u === H.u0 || u === H.u1) : (v === H.v0 || v === H.v1);
    for (y = H.top + 1; y < roofY; y++) bl[(y << 8) | base] = gable ? H.wallMat : B.PLANKS;
    bl[(roofY << 8) | base] = H.roof;
    if (H.chimney && u === H.u0 + 1 && v === H.v0 + 1) {
      for (y = roofY; y <= H.top + 2 + Math.ceil(((H.axisX ? H.v1 - H.v0 : H.u1 - H.u0)) / 2); y++) bl[(y << 8) | base] = B.COBBLE;
    }
  } else {
    bl[(roofY << 8) | base] = H.roof;
  }
}

function towerColumn(bl, base, x, z, t) {
  var dx = Math.abs(x + 0.5 - t.x), dz = Math.abs(z + 0.5 - t.z), cheb = Math.max(dx, dz), y;
  var edge = cheb > t.hw - 1;
  var overhang = cheb >= t.hw;
  if (!overhang) {
    var floor = t.bell ? GROUND : GROUND;
    for (y = floor + 1; y <= t.top; y++) {
      var id = B.STONEBRICK;
      if (edge) {
        var alongT = dx > dz ? z : x;
        if (((y - GROUND) % 6 === 3 || (y - GROUND) % 6 === 4) && ((alongT % 3) + 3) % 3 === 1 && y > GROUND + 6) id = B.WINDOW;
        else if (hash3(x, y, z, 86) < 0.08) id = B.MOSSY;
        // banners on the tower faces
        if (!t.bell && ((alongT % 6) + 6) % 6 === 0 && y > t.top - 13 && y < t.top - 2 && dx !== dz) id = B.BANNER;
      }
      if (t.bell && y > t.top - 6 && y < t.top - 1 && edge && Math.min(dx, dz) < 1.6) id = B.AIR;  // belfry arches
      bl[(y << 8) | base] = id;
    }
    if (t.bell) bl[(GROUND << 8) | base] = B.STONEBRICK;
  }
  if (t.flat) {
    if (edge && !overhang) { var a2 = (dx > dz ? z : x); if ((((a2 % 3) + 3) % 3) !== 1) bl[((t.top + 1) << 8) | base] = B.STONEBRICK; }
  } else {
    var ry = t.top + 1 + Math.floor(t.hw - cheb + 0.5);
    for (y = t.top + 1; y <= ry; y++) bl[(y << 8) | base] = (y === ry || overhang) ? t.roof : B.PLANKS;
    if (overhang) { for (y = t.top + 1; y < ry; y++) bl[(y << 8) | base] = 0; }
    if (cheb < 0.6) for (y = ry + 1; y <= ry + 3; y++) bl[(y << 8) | base] = B.TIMBER;
  }
}

function fieldColumn(bl, base, x, z, h, forest) {
  var y;
  if (h <= SEA) return;
  // dirt road leading south from the gate
  if (z > DR && Math.abs(x + 0.5) < 3.5 && z < DR + 260) { bl[(h << 8) | base] = B.DIRT_PATH; return; }
  // outer ward structures
  var ow = outworkAt(x, z);
  if (ow) { outworkColumn(bl, base, x, z, h, ow); return; }
  // watchtowers / ruins
  var gx = Math.floor(x / WCELL), gz = Math.floor(z / WCELL), wt = watchtower(gx, gz);
  if (wt) {
    var dx = Math.abs(x + 0.5 - wt.x - 0.5), dz = Math.abs(z + 0.5 - wt.z - 0.5);
    if (dx < 3.5 && dz < 3.5) {
      var top = groundH(wt.x, wt.z) + wt.h;
      if (wt.ruin) top -= Math.floor(hash2(x, z, 76) * 9);
      var hollow = dx < 1.5 && dz < 1.5;
      for (y = h + 1; y <= top; y++) {
        if (hollow && y > h + 3 && y < top - 1) continue;
        bl[(y << 8) | base] = hash3(x, y, z, 77) < 0.3 ? B.MOSSY : (hash3(x, y, z, 78) < 0.4 ? B.COBBLE : B.STONEBRICK);
      }
      if (!wt.ruin && (dx > 2.5 || dz > 2.5) && ((x + z) & 1)) bl[((top + 1) << 8) | base] = B.STONEBRICK;
      return;
    }
  }
  var r = hash2(x, z, 11);
  var near = Math.max(Math.abs(x), Math.abs(z)) < DR + 70;
  if (forest) {
    if (r < 0.14) bl[((h + 1) << 8) | base] = B.TALLGRASS;
    else if (r < 0.15) bl[((h + 1) << 8) | base] = B.ROSE;
    return;
  }
  // farm plots near the walls: hay bales
  if (near && hash2(Math.floor(x / 9), Math.floor(z / 9), 87) < 0.3 && r < 0.03) {
    bl[((h + 1) << 8) | base] = B.HAY; if (r < 0.012) bl[((h + 2) << 8) | base] = B.HAY; return;
  }
  // small oak trees here and there
  var tx = Math.floor(x / 9), tz = Math.floor(z / 9);
  if (hash2(tx, tz, 88) < 0.07) {
    var ox = tx * 9 + 2 + Math.floor(hash2(tx, tz, 89) * 5), oz = tz * 9 + 2 + Math.floor(hash2(tx, tz, 90) * 5);
    var ddx = x - ox, ddz = z - oz, th = 4 + Math.floor(hash2(tx, tz, 91) * 3);
    if (Math.abs(ddx) <= 2 && Math.abs(ddz) <= 2) {
      var hh = groundH(ox, oz);
      if (ddx === 0 && ddz === 0) { for (y = hh + 1; y <= hh + th; y++) bl[(y << 8) | base] = B.LOG; bl[(hh << 8) | base] = B.DIRT; }
      for (y = hh + th - 2; y <= hh + th + 1; y++) {
        var rr = y >= hh + th ? 1 : 2;
        if (Math.abs(ddx) > rr || Math.abs(ddz) > rr) continue;
        if (Math.abs(ddx) === rr && Math.abs(ddz) === rr && (y === hh + th + 1 || hash3(x, y, z, 92) < 0.5)) continue;
        if (!bl[(y << 8) | base]) bl[(y << 8) | base] = B.LEAVES;
      }
      return;
    }
  }
  if (r < 0.13) bl[((h + 1) << 8) | base] = B.TALLGRASS;
  else if (r < 0.145) bl[((h + 1) << 8) | base] = B.ROSE;
  else if (r < 0.16) bl[((h + 1) << 8) | base] = B.DANDELION;
}

function placeGiantTrees(bl, x0, z0) {
  var M = 24;
  var gx0 = Math.floor((x0 - M) / TCELL), gx1 = Math.floor((x0 + CS + M) / TCELL);
  var gz0 = Math.floor((z0 - M) / TCELL), gz1 = Math.floor((z0 + CS + M) / TCELL);
  for (var gz = gz0; gz <= gz1; gz++) for (var gx = gx0; gx <= gx1; gx++) {
    var t = giantTree(gx, gz);
    if (!t) continue;
    if (t.x + 26 < x0 || t.x - 26 > x0 + CS || t.z + 26 < z0 || t.z - 26 > z0 + CS) continue;
    rasterTree(bl, x0, z0, t);
  }
}
function setB(bl, x0, z0, x, y, z, id, force) {
  var lx = x - x0, lz = z - z0;
  if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= CH) return;
  var i = (y << 8) | (lz << 4) | lx, c = bl[i];
  if (force || c === 0 || c === B.TALLGRASS || c === B.ROSE || c === B.DANDELION || c === B.LEAVES) bl[i] = id;
}
function rasterTree(bl, x0, z0, t) {
  var x, y, z, i;
  // trunk with root flare and taper
  var R = Math.ceil(t.rt + 3);
  for (z = Math.max(z0, t.z - R); z <= Math.min(z0 + CS - 1, t.z + R); z++)
    for (x = Math.max(x0, t.x - R); x <= Math.min(x0 + CS - 1, t.x + R); x++) {
      var dx = x - t.x, dz = z - t.z, d = Math.sqrt(dx * dx + dz * dz);
      for (y = t.base - 3; y <= t.base + t.th; y++) {
        var k = (y - t.base) / t.th;
        var rr = t.rt * (1 - 0.38 * k) + Math.max(0, 2.6 - (y - t.base) * 0.45);
        if (d < rr) setB(bl, x0, z0, x, y, z, B.BARK, true);
      }
    }
  // branches and roots
  for (i = 0; i < t.br.length; i++) {
    var b = t.br[i], len = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]), n = Math.ceil(len / 0.6);
    for (var s = 0; s <= n; s++) {
      var f = s / n, px = b[0] + (b[3] - b[0]) * f, py = b[1] + (b[4] - b[1]) * f, pz = b[2] + (b[5] - b[2]) * f;
      var rad = b[6] * (1 - f * 0.4);
      if (px + rad < x0 || px - rad > x0 + CS || pz + rad < z0 || pz - rad > z0 + CS) continue;
      var r2 = rad * rad;
      for (var zz = Math.floor(pz - rad); zz <= Math.floor(pz + rad); zz++)
        for (var yy = Math.floor(py - rad); yy <= Math.floor(py + rad); yy++)
          for (var xx = Math.floor(px - rad); xx <= Math.floor(px + rad); xx++) {
            var ex = xx + 0.5 - px, ey = yy + 0.5 - py, ez = zz + 0.5 - pz;
            if (ex * ex + ey * ey + ez * ez <= r2) setB(bl, x0, z0, xx, yy, zz, B.BARK, false);
          }
    }
  }
  // canopy blobs
  for (i = 0; i < t.blobs.length; i++) {
    var c = t.blobs[i], rx = c[3], ry = c[4];
    var xa = Math.max(x0, Math.floor(c[0] - rx)), xb = Math.min(x0 + CS - 1, Math.floor(c[0] + rx));
    var za = Math.max(z0, Math.floor(c[2] - rx)), zb = Math.min(z0 + CS - 1, Math.floor(c[2] + rx));
    if (xa > xb || za > zb) continue;
    for (z = za; z <= zb; z++) for (x = xa; x <= xb; x++) for (y = Math.floor(c[1] - ry); y <= Math.floor(c[1] + ry); y++) {
      var qx = (x + 0.5 - c[0]) / rx, qy = (y + 0.5 - c[1]) / ry, qz = (z + 0.5 - c[2]) / rx;
      var e = qx * qx + qy * qy + qz * qz;
      if (e < 1 - hash3(x, y, z, 93) * 0.32) setB(bl, x0, z0, x, y, z, c[5], false);
    }
  }
}
function supplyY(s) { return s.wall ? WALL_TOP : groundH(s.x, s.z); }
function placeSupply(bl, x0, z0) {
  for (var i = 0; i < SUPPLY.length; i++) {
    var s = SUPPLY[i];
    if (s.x + 3 < x0 || s.x - 3 > x0 + CS || s.z + 3 < z0 || s.z - 3 > z0 + CS) continue;
    var gy = supplyY(s);
    for (var dz = -2; dz <= 2; dz++) for (var dx = -2; dx <= 2; dx++) {
      setB(bl, x0, z0, s.x + dx, gy, s.z + dz, B.PLANKS, true);
      for (var y = gy + 1; y <= gy + 4; y++) setB(bl, x0, z0, s.x + dx, y, s.z + dz, B.AIR, true);
    }
    setB(bl, x0, z0, s.x - 2, gy + 1, s.z - 2, B.CRATE, true);
    setB(bl, x0, z0, s.x - 1, gy + 1, s.z - 2, B.CRATE, true);
    setB(bl, x0, z0, s.x - 2, gy + 2, s.z - 2, B.CRATE, true);
    setB(bl, x0, z0, s.x + 2, gy + 1, s.z + 2, B.CRATE, true);
    setB(bl, x0, z0, s.x + 2, gy + 1, s.z - 2, B.HAY, true);
  }
}

/* ---- top-down colour for the minimap ---- */
function mapColor(x, z) {
  var ax = Math.abs(x + 0.5), az = Math.abs(z + 0.5), r = Math.max(ax, az);
  if (r < DR + 2) {
    var t = towerAt(x, z);
    if (t) return t.flat ? [150, 150, 158] : t.roof === B.ROOF_SLATE ? [70, 86, 120] : [168, 70, 52];
    if (r >= DR - WALL_T) return r < DR ? [176, 176, 182] : [92, 140, 60];
    if (isStreet(x, z)) return [150, 140, 122];
    if (inYard(x, z)) return [140, 112, 80];
    var li = Math.floor((x + LOT_OFF) / LOT), lj = Math.floor((z + LOT_OFF) / LOT);
    var u = x + LOT_OFF - li * LOT, v = z + LOT_OFF - lj * LOT, H = houseFor(li, lj);
    if (!H.ok) return [92, 150, 64];
    if (u >= H.u0 - 1 && u <= H.u1 + 1 && v >= H.v0 - 1 && v <= H.v1 + 1) {
      var ry = houseRoofY(u, v), sh = 0.75 + (ry - H.top) * 0.06;
      return H.roof === B.ROOF_RED ? [178 * sh, 72 * sh, 54 * sh] : [80 * sh, 96 * sh, 130 * sh];
    }
    return [132, 126, 112];
  }
  var h = groundH(x, z);
  if (h <= SEA) return [52, 98, 190];
  var gx = Math.floor(x / TCELL), gz = Math.floor(z / TCELL);
  for (var j = gz - 1; j <= gz + 1; j++) for (var i = gx - 1; i <= gx + 1; i++) {
    var tr = giantTree(i, j);
    if (!tr) continue;
    var dx = x - tr.x, dz = z - tr.z, d2 = dx * dx + dz * dz;
    if (d2 < tr.rt * tr.rt) return [96, 70, 44];
    if (d2 < 15 * 15) return [34, 92, 40];
  }
  var wt = watchtower(Math.floor(x / WCELL), Math.floor(z / WCELL));
  if (wt && Math.abs(x - wt.x) < 4 && Math.abs(z - wt.z) < 4) return [130, 130, 134];
  var ow = outworkAt(x, z);
  if (ow) return ow.type === 'cottage' ? (ow.roof === B.ROOF_RED ? [170, 74, 56] : [82, 98, 130]) : ow.type === 'scaffold' ? [140, 104, 64] : [150, 150, 156];
  if (z > DR && Math.abs(x + 0.5) < 3.5 && z < DR + 260) return [150, 124, 86];
  var hs = (h - GROUND) * 2;
  if (h > GROUND + 30) return [128 + hs * 0.3, 128 + hs * 0.3, 132 + hs * 0.3];
  return forestAt(x, z) ? [62 + hs, 120 + hs, 52 + hs] : [100 + hs, 158 + hs, 70 + hs];
}

/* Worker entry point */
if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof importScripts === 'function') {
  self.onmessage = function (e) {
    var d = e.data;
    if (d.type === 'init') initGen(d.seed);
    else if (d.type === 'gen') {
      var r = generateChunk(d.cx, d.cz);
      self.postMessage({ type: 'chunk', gid: d.gid, cx: d.cx, cz: d.cz, blocks: r.blocks, biomes: r.biomes, maxY: r.maxY }, [r.blocks.buffer, r.biomes.buffer]);
    }
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initGen: initGen, generateChunk: generateChunk, groundH: groundH, mapColor: mapColor, outwork: outwork, outworkAt: outworkAt, B: B, BIOME: BIOME };
}
