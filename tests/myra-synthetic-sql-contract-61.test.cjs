const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(process.cwd(), "database/tests", file), "utf8");
const credit = read("journey_myra_credit_idempotence_synthetic_61.sql");
const fk = read("journey_myra_fk_transition_synthetic_61.sql");

for (const [name, sql] of [["credit idempotence", credit], ["foreign-key transition", fk]]) {
  test(`synthetic ${name} uses only temp tables and rolls back`, () => {
    assert.match(sql, /\bBEGIN\s*;/i);
    assert.match(sql, /\bROLLBACK\s*;/i);
    assert.match(sql, /CREATE\s+TEMP\s+TABLE/i);
    assert.doesNotMatch(sql, /\b(?:ALTER|DELETE\s+FROM|UPDATE|INSERT\s+INTO|DROP)\s+(?:TABLE\s+)?public\./i);
    assert.doesNotMatch(sql, /\bCOMMIT\s*;/i);
  });
}

test("idempotence rehearsal guards duplicate credit by source mission", () => {
  assert.match(credit, /source_mission_id\s+uuid\s+NOT\s+NULL\s+UNIQUE/i);
  assert.match(credit, /ON\s+CONFLICT\s*\(source_mission_id\)\s+DO\s+NOTHING/i);
  assert.match(credit, /Duplicate MYRA credit on retry/);
  assert.match(credit, /MYRA history lost or duplicated after parent deletion/);
});

test("FK rehearsal models cascade-to-set-null with immutable source mission", () => {
  assert.match(fk, /ALTER\s+TABLE\s+rehearsal_ledger\s+ADD\s+COLUMN\s+source_mission_id/i);
  assert.match(fk, /ON\s+DELETE\s+SET\s+NULL/i);
  assert.match(fk, /Credit was not preserved after synthetic parent deletion/);
});
