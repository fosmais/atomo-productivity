const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadTs(relativePath) {
  const source = fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: relativePath,
    reportDiagnostics: true,
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled.outputText)(require, mod, mod.exports);
  return mod.exports;
}

const { calculateAvailability } = loadTs("src/lib/availability-engine.ts");
const { getGoogleEventInterval } = loadTs("src/lib/google-event-time.ts");
const at = (iso) => new Date(iso);
const iso = (intervals) => intervals.map(({ start, end }) => [start.toISOString(), end.toISOString()]);

test("overlapping local and Google blocks are merged without duplicates", () => {
  const window = { start: at("2026-11-04T09:00:00Z"), end: at("2026-11-04T18:00:00Z") };
  const result = calculateAvailability(window, [
    { start: at("2026-11-04T10:00:00Z"), end: at("2026-11-04T12:00:00Z") },
    { start: at("2026-11-04T11:30:00Z"), end: at("2026-11-04T13:00:00Z") },
    { start: at("2026-11-04T15:00:00Z"), end: at("2026-11-04T16:00:00Z") },
  ]);
  assert.deepEqual(iso(result.blocked), [
    ["2026-11-04T10:00:00.000Z", "2026-11-04T13:00:00.000Z"],
    ["2026-11-04T15:00:00.000Z", "2026-11-04T16:00:00.000Z"],
  ]);
  assert.equal(result.available.length, 3);
});

test("blocks outside window are clipped, adjacent blocks merged", () => {
  const result = calculateAvailability(
    { start: at("2026-11-04T09:00:00Z"), end: at("2026-11-04T12:00:00Z") },
    [
      { start: at("2026-11-04T08:00:00Z"), end: at("2026-11-04T10:00:00Z") },
      { start: at("2026-11-04T10:00:00Z"), end: at("2026-11-04T11:00:00Z") },
      { start: at("2026-11-04T14:00:00Z"), end: at("2026-11-04T15:00:00Z") },
    ]
  );
  assert.deepEqual(iso(result.blocked), [["2026-11-04T09:00:00.000Z", "2026-11-04T11:00:00.000Z"]]);
  assert.deepEqual(iso(result.available), [["2026-11-04T11:00:00.000Z", "2026-11-04T12:00:00.000Z"]]);
});

test("Google all-day event uses exclusive end and calendar timezone", () => {
  const interval = getGoogleEventInterval({
    start: "2026-11-04",
    end: "2026-11-05",
    calendarTimeZone: "America/Sao_Paulo",
  });
  assert.deepEqual(iso([interval]), [["2026-11-04T03:00:00.000Z", "2026-11-05T03:00:00.000Z"]]);
});

test("Google timed event preserves UTC offset", () => {
  const interval = getGoogleEventInterval({
    start: "2026-11-04T09:00:00-03:00",
    end: "2026-11-04T10:00:00-03:00",
    calendarTimeZone: "America/Sao_Paulo",
  });
  assert.deepEqual(iso([interval]), [["2026-11-04T12:00:00.000Z", "2026-11-04T13:00:00.000Z"]]);
});

test("invalid and missing Google intervals fail closed", () => {
  assert.throws(() => getGoogleEventInterval({ start: null, end: null }), /sem inicio ou fim/);
  assert.throws(() => getGoogleEventInterval({ start: "2026-11-04", end: "2026-11-05" }), /sem fuso horario/);
  assert.throws(() => getGoogleEventInterval({
    start: "2026-11-04T11:00:00Z", end: "2026-11-04T10:00:00Z",
  }), /Intervalo invalido/);
});
