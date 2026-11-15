import assert from "node:assert/strict";
import test from "node:test";

import {
  buildColorIndex,
  deltaE2000,
  derivePaintRoles,
  hexToLab,
  hexToLch,
  hexToOklch,
  hexToSrgb,
  labToHex,
  labToLch,
  labToXyz,
  lchToLab,
  lchToHex,
  linearToOklab,
  linearToSrgb,
  linearToXyz,
  matchCloseness,
  nearestPaints,
  NO_CLOSE_MATCH_DELTA_E,
  oklabToLinear,
  oklchToHex,
  srgbToHex,
  srgbToLinear,
  xyzToLab,
  xyzToLinear,
} from "./color-matching.ts";
import type { Lab, PaintRole } from "./color-matching.ts";

function near(actual: number, expected: number, tolerance = 1e-5): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (±${tolerance})`);
}

// Full 34-pair supplementary dataset, Sharma, Wu & Dalal (2005), not just the first six.
// https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
const referencePairs = `50.0000	2.6772	-79.7751	50.0000	0.0000	-82.7485	2.0425
50.0000	3.1571	-77.2803	50.0000	0.0000	-82.7485	2.8615
50.0000	2.8361	-74.0200	50.0000	0.0000	-82.7485	3.4412
50.0000	-1.3802	-84.2814	50.0000	0.0000	-82.7485	1.0000
50.0000	-1.1848	-84.8006	50.0000	0.0000	-82.7485	1.0000
50.0000	-0.9009	-85.5211	50.0000	0.0000	-82.7485	1.0000
50.0000	0.0000	0.0000	50.0000	-1.0000	2.0000	2.3669
50.0000	-1.0000	2.0000	50.0000	0.0000	0.0000	2.3669
50.0000	2.4900	-0.0010	50.0000	-2.4900	0.0009	7.1792
50.0000	2.4900	-0.0010	50.0000	-2.4900	0.0010	7.1792
50.0000	2.4900	-0.0010	50.0000	-2.4900	0.0011	7.2195
50.0000	2.4900	-0.0010	50.0000	-2.4900	0.0012	7.2195
50.0000	-0.0010	2.4900	50.0000	0.0009	-2.4900	4.8045
50.0000	-0.0010	2.4900	50.0000	0.0010	-2.4900	4.8045
50.0000	-0.0010	2.4900	50.0000	0.0011	-2.4900	4.7461
50.0000	2.5000	0.0000	50.0000	0.0000	-2.5000	4.3065
50.0000	2.5000	0.0000	73.0000	25.0000	-18.0000	27.1492
50.0000	2.5000	0.0000	61.0000	-5.0000	29.0000	22.8977
50.0000	2.5000	0.0000	56.0000	-27.0000	-3.0000	31.9030
50.0000	2.5000	0.0000	58.0000	24.0000	15.0000	19.4535
50.0000	2.5000	0.0000	50.0000	3.1736	0.5854	1.0000
50.0000	2.5000	0.0000	50.0000	3.2972	0.0000	1.0000
50.0000	2.5000	0.0000	50.0000	1.8634	0.5757	1.0000
50.0000	2.5000	0.0000	50.0000	3.2592	0.3350	1.0000
60.2574	-34.0099	36.2677	60.4626	-34.1751	39.4387	1.2644
63.0109	-31.0961	-5.8663	62.8187	-29.7946	-4.0864	1.2630
61.2901	3.7196	-5.3901	61.4292	2.2480	-4.9620	1.8731
35.0831	-44.1164	3.7933	35.0232	-40.0716	1.5901	1.8645
22.7233	20.0904	-46.6940	23.0331	14.9730	-42.5619	2.0373
36.4612	47.8580	18.3852	36.2715	50.5065	21.2231	1.4146
90.8027	-2.0831	1.4410	91.1528	-1.6435	0.0447	1.4441
90.9257	-0.5406	-0.9208	88.6381	-0.8985	-0.7239	1.5381
6.7747	-0.2908	-2.4247	5.8714	-0.0985	-2.2286	0.6377
2.0776	0.0795	-1.1350	0.9033	-0.0636	-0.5514	0.9082`;

const referenceRows = referencePairs.trim().split("\n");
assert.equal(referenceRows.length, 34);
for (const [index, row] of referenceRows.entries()) {
  void test(`CIEDE2000 published reference pair ${index + 1} in both directions`, () => {
    const [l1, a1, b1, l2, a2, b2, expected] = row.trim().split(/\s+/).map(Number);
    const first = { l: l1, a: a1, b: b1 };
    const second = { l: l2, a: a2, b: b2 };
    near(deltaE2000(first, second), expected, 0.00005);
    near(deltaE2000(second, first), expected, 0.00005);
    assert.equal(deltaE2000(first, first), 0);
  });
}

void test("hex parsing normalizes shorthand/case and rejects alpha, malformed and empty input", () => {
  for (const value of ["#abc", "ABC", " #aabbCC ", "aabbcc"]) {
    assert.equal(srgbToHex(hexToSrgb(value)), "#aabbcc");
  }
  for (const value of ["", " ", "#12", "#abcd", "#aabbccdd", "#gg0000", "red", "#abcxyz"]) {
    assert.throws(() => hexToSrgb(value), RangeError);
  }
  assert.equal(srgbToHex({ r: -0.5, g: 0.5, b: 2 }), "#0080ff");
});

void test("sRGB transfer functions use the standard piecewise breakpoints", () => {
  near(srgbToLinear({ r: 0.04045, g: 0.5, b: 1 }).r, 0.04045 / 12.92, 1e-12);
  near(srgbToLinear({ r: 0.04046, g: 0.5, b: 1 }).r, ((0.04046 + 0.055) / 1.055) ** 2.4, 1e-12);
  near(srgbToLinear({ r: 0, g: 0.5, b: 1 }).g, 0.21404114048223255, 1e-12);
  near(linearToSrgb({ r: 0.0031308, g: 0, b: 1 }).r, 0.0031308 * 12.92, 1e-12);
  near(linearToSrgb({ r: 0.0031309, g: 0, b: 1 }).r, 1.055 * 0.0031309 ** (1 / 2.4) - 0.055, 1e-12);
});

void test("D65 XYZ and CIELAB agree with published sRGB primary values", () => {
  const white = linearToXyz({ r: 1, g: 1, b: 1 });
  near(white.x, 0.95047);
  near(white.y, 1);
  near(white.z, 1.08883);
  const cases: [string, Lab][] = [
    ["#ff0000", { l: 53.2408, a: 80.0925, b: 67.2032 }],
    ["#00ff00", { l: 87.7347, a: -86.1827, b: 83.1793 }],
    ["#0000ff", { l: 32.297, a: 79.1875, b: -107.8602 }],
    ["#ffffff", { l: 100, a: 0, b: 0 }],
    ["#000000", { l: 0, a: 0, b: 0 }],
  ];
  for (const [hex, expected] of cases) {
    const lab = hexToLab(hex);
    near(lab.l, expected.l, 0.0001);
    near(lab.a, expected.a, 0.0001);
    near(lab.b, expected.b, 0.0001);
  }
  assert.deepEqual(labToXyz({ l: 0, a: 0, b: 0 }), { x: 0, y: 0, z: 0 });
});

void test("XYZ/Lab piecewise transition and LCh hue wrap/achromatic handling", () => {
  for (const l of [0, 0.1, 7.9999, 8, 8.0001, 50, 100]) {
    const source = { l, a: -0.05, b: 0.04 };
    const roundTrip = xyzToLab(labToXyz(source));
    near(roundTrip.l, l, 1e-10);
    near(roundTrip.a, source.a, 1e-10);
    near(roundTrip.b, source.b, 1e-10);
  }
  assert.deepEqual(labToLch({ l: 40, a: 0, b: 0 }), { l: 40, c: 0, h: 0 });
  for (const h of [-720, -1, 0, 45, 180, 359, 361, 720]) {
    const lab = lchToLab({ l: 50, c: 30, h });
    const lch = labToLch(lab);
    near(lch.h, ((h % 360) + 360) % 360, 1e-10);
    near(lch.c, 30, 1e-10);
  }
});

void test("OKLab and OKLCh agree with Ottosson's sRGB red reference", () => {
  const red = linearToOklab({ r: 1, g: 0, b: 0 });
  near(red.l, 0.6279553606, 1e-9);
  near(red.a, 0.2248630611, 1e-9);
  near(red.b, 0.1258462985, 1e-9);
  const lch = hexToOklch("#ff0000");
  near(lch.l, red.l, 1e-12);
  near(lch.c, 0.2576833077, 1e-9);
  near(lch.h, 29.2338851923, 1e-8);
  assert.equal(oklchToHex(lch), "#ff0000");
});

void test("all color conversion chains round trip a dense RGB grid, grays and low channels", () => {
  const values = [0, 1, 2, 10, 11, 32, 64, 128, 192, 254, 255];
  for (const r of values) {
    for (const g of values) {
      for (const b of values) {
        const rgb = { r: r / 255, g: g / 255, b: b / 255 };
        const hex = srgbToHex(rgb);
        assert.equal(labToHex(hexToLab(hex)), hex);
        assert.equal(lchToHex(hexToLch(hex)), hex);
        assert.equal(oklchToHex(hexToOklch(hex)), hex);
        const linear = srgbToLinear(rgb);
        const xyzRoundTrip = xyzToLinear(linearToXyz(linear));
        const okRoundTrip = oklabToLinear(linearToOklab(linear));
        for (const channel of ["r", "g", "b"] as const) {
          near(xyzRoundTrip[channel], linear[channel], 3e-7);
          near(okRoundTrip[channel], linear[channel], 3e-7);
        }
      }
    }
  }
});

const paints = [
  { id: "far", hex: "#0000ff", owned: true, available: true, name: "Blue" },
  { id: "z-exact", hex: "#a44c40", owned: false, available: true, name: "Substitute" },
  { id: "a-exact", hex: "#a44c40", owned: false, available: false, name: "Library" },
  { id: "near", hex: "#a64d42", owned: true, available: true, name: "Owned" },
  { id: "invalid", hex: "#nope", owned: true, available: true, name: "Invalid" },
  { id: "missing", hex: null, owned: true, available: true, name: "Missing" },
];

void test("compact index retains generic records, omits invalid/missing hex and does not mutate input", () => {
  const original = structuredClone(paints);
  const index = buildColorIndex(paints);
  assert.equal(index.paints.length, 4);
  assert.equal(index.labValues.length, 12);
  assert.equal(index.flags.byteLength, 4);
  assert.equal(index.paints[0], paints[0]);
  assert.deepEqual(paints, original);
  assert.deepEqual(buildColorIndex([]).paints, []);
  assert.equal(buildColorIndex([{ id: "absent", owned: false, available: false }]).paints.length, 0);
});

void test("nearest colors rank by CIEDE2000, deterministic ID ties, top-N and exclusions", () => {
  const index = buildColorIndex(paints);
  const all = nearestPaints(index, "#a44c40");
  assert.deepEqual(
    all.map(({ paint }) => paint.id),
    ["a-exact", "z-exact", "near", "far"],
  );
  assert.equal(all[0].deltaE, 0);
  assert.equal(all[0].paint.name, "Library");
  assert.ok(all[2].deltaE < all[3].deltaE);
  assert.deepEqual(nearestPaints(index, "#a44c40", { limit: 2 }), all.slice(0, 2));
  assert.deepEqual(nearestPaints(index, "#a44c40", { limit: 1.9 }), all.slice(0, 1));
  assert.deepEqual(nearestPaints(index, "#a44c40", { limit: 0 }), []);
  assert.deepEqual(
    nearestPaints(index, "#a44c40", { excludeIds: ["a-exact", "near", "unknown"] }).map(
      ({ paint }) => paint.id,
    ),
    ["z-exact", "far"],
  );
  assert.deepEqual(nearestPaints(buildColorIndex([]), "#123"), []);
  assert.throws(() => nearestPaints(index, "invalid"), RangeError);
  for (const limit of [-1, Infinity, NaN]) {
    assert.throws(() => nearestPaints(index, "#123", { limit }), RangeError);
  }
  assert.equal(NO_CLOSE_MATCH_DELTA_E, 10);
  assert.ok(nearestPaints(buildColorIndex([paints[0]]), "#a44c40")[0].deltaE > NO_CLOSE_MATCH_DELTA_E);
});

void test("owned/available use independent server flags, never infer substitutes or ownership", () => {
  const index = buildColorIndex(paints);
  assert.deepEqual(
    nearestPaints(index, "#a44c40", { filter: "owned" }).map(({ paint }) => paint.id),
    ["near", "far"],
  );
  assert.deepEqual(
    nearestPaints(index, "#a44c40", { filter: "available" }).map(({ paint }) => paint.id),
    ["z-exact", "near", "far"],
  );
  const unusual = buildColorIndex([{ id: "server", hex: "#123", owned: true, available: false }]);
  assert.equal(nearestPaints(unusual, "#123", { filter: "owned" }).length, 1);
  assert.equal(nearestPaints(unusual, "#123", { filter: "available" }).length, 0);
});

void test("index is an availability snapshot; default limit is five and identical ID ties stay stable", () => {
  const catalog = Array.from({ length: 8 }, (_, i) => ({
    id: "same-id",
    hex: "#abc",
    owned: false,
    available: true,
    sequence: i,
  }));
  const index = buildColorIndex(catalog);
  catalog[0].owned = true;
  catalog[0].available = false;
  assert.deepEqual(
    nearestPaints(index, "#abc").map(({ paint }) => paint.sequence),
    [0, 1, 2, 3, 4],
  );
  assert.equal(nearestPaints(index, "#abc", { filter: "owned" }).length, 0);
  assert.equal(nearestPaints(buildColorIndex(catalog), "#abc", { filter: "owned" }).length, 1);
  assert.equal(nearestPaints(index, "#abc", { excludeIds: ["same-id"] }).length, 0);
});

void test("bounded top-N agrees with an exhaustive CIEDE2000 sort for a large deterministic catalog", () => {
  const catalog = Array.from({ length: 2000 }, (_, i) => ({
    id: String(i).padStart(4, "0"),
    hex: `#${((i * 7919) % 0x1000000).toString(16).padStart(6, "0")}`,
    owned: i % 2 === 0,
    available: i % 3 === 0,
  }));
  const index = buildColorIndex(catalog);
  const target = hexToLab("#7c4a95");
  for (const filter of ["library", "owned", "available"] as const) {
    const expected = catalog
      .filter((paint) => (filter === "library" || paint[filter]) && paint.id !== "0000")
      .map((paint) => ({ paint, deltaE: deltaE2000(target, hexToLab(paint.hex)) }))
      .sort((a, b) => a.deltaE - b.deltaE || (a.paint.id < b.paint.id ? -1 : 1));
    for (const limit of [1, 5, 25, 3000]) {
      assert.deepEqual(
        nearestPaints(index, "#7c4a95", { filter, limit, excludeIds: ["0000"] }),
        expected.slice(0, limit),
      );
    }
  }
});

void test("role derivation lightens/warms/desaturates highlights and darkens/cools shadows", () => {
  const base = "#81654f";
  const roles = derivePaintRoles(base, "base", 50);
  const b = hexToLab(base);
  const highlight = hexToLab(roles.highlight);
  const shadow = hexToLab(roles.shadow);
  const complement = labToLch(hexToLab(roles.complement));
  assert.equal(roles.base, base);
  near(highlight.l - b.l, 21.5, 0.25);
  near(b.l - shadow.l, 21.5, 0.25);
  const original = labToLch(b);
  near(labToLch(highlight).c, original.c * 0.88, 0.5);
  near(labToLch(shadow).c, original.c * 0.92, 0.5);
  const expectedWarmHue = original.h + ((6 * 21.5) / 35) * Math.sin(((85 - original.h) * Math.PI) / 180);
  const expectedCoolHue = original.h + ((6 * 21.5) / 35) * Math.sin(((265 - original.h) * Math.PI) / 180);
  near(labToLch(highlight).h, expectedWarmHue, 1);
  near(labToLch(shadow).h, expectedCoolHue, 1);
  assert.ok(labToLch(highlight).c < labToLch(b).c);
  near(complement.h, (labToLch(b).h + 180) % 360, 1);
});

void test("strength endpoints map to 8..35 L*, clamp out-of-range and reject nonfinite", () => {
  const base = "#777777";
  const l = hexToLab(base).l;
  near(hexToLab(derivePaintRoles(base, "base", 0).highlight).l - l, 8, 0.3);
  near(hexToLab(derivePaintRoles(base, "base", 100).highlight).l - l, 35, 0.3);
  assert.deepEqual(derivePaintRoles(base, "base", -10), derivePaintRoles(base, "base", 0));
  assert.deepEqual(derivePaintRoles(base, "base", 110), derivePaintRoles(base, "base", 100));
  for (const strength of [NaN, Infinity, -Infinity])
    assert.throws(() => derivePaintRoles(base, "base", strength), RangeError);
  assert.throws(() => derivePaintRoles("not a hex", "base", 50), RangeError);
});

void test("inverse base inference round trips all roles away from gamut boundaries", () => {
  for (const base of ["#817565", "#787f87", "#8a746d"]) {
    for (const strength of [0, 30, 60]) {
      const forward = derivePaintRoles(base, "base", strength);
      for (const role of ["base", "complement", "highlight", "shadow"] as PaintRole[]) {
        const inferred = derivePaintRoles(forward[role], role, strength);
        assert.equal(inferred[role], forward[role]);
        assert.ok(deltaE2000(hexToLab(inferred.base), hexToLab(base)) < 1.2, `${base}/${role}/${strength}`);
      }
    }
  }
});

void test("inverse hue inference is stable across the zero-degree seam", () => {
  for (const h of [0, 1, 85, 179, 265, 359]) {
    const hex = lchToHex({ l: 50, c: 15, h });
    const forward = derivePaintRoles(hex, "base", 50);
    for (const role of ["highlight", "shadow", "complement"] as const) {
      const recovered = derivePaintRoles(forward[role], role, 50);
      assert.ok(deltaE2000(hexToLab(recovered.base), hexToLab(hex)) < 1.2);
    }
  }
});

void test("role mapping is deterministic, valid and preserves selected input at gamut extremes", () => {
  for (const hex of ["#000", "#fff", "#f00", "#0f0", "#00f", "#ff00ff", "#ffff00"]) {
    for (const role of ["base", "complement", "highlight", "shadow"] as PaintRole[]) {
      for (const strength of [0, 50, 100]) {
        const result = derivePaintRoles(hex, role, strength);
        assert.deepEqual(result, derivePaintRoles(hex, role, strength));
        assert.equal(result[role], srgbToHex(hexToSrgb(hex)));
        for (const value of Object.values(result)) assert.match(value, /^#[0-9a-f]{6}$/);
      }
    }
  }
  assert.equal(derivePaintRoles("#fff", "base", 100).highlight, "#ffffff");
  assert.equal(derivePaintRoles("#000", "base", 100).shadow, "#000000");
});

test("matchCloseness buckets advisory ΔE values with inclusive boundaries", () => {
  assert.equal(matchCloseness(0), "exact");
  assert.equal(matchCloseness(2), "exact");
  assert.equal(matchCloseness(2.01), "close");
  assert.equal(matchCloseness(5), "close");
  assert.equal(matchCloseness(10), "similar");
  assert.equal(matchCloseness(10.5), "distant");
  assert.equal(matchCloseness(Number.NaN), "distant");
  assert.equal(matchCloseness(-1), "distant");
});
