const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard/myryra-finance-starter.tsx"), "utf8");
const section = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing wallet section: ${start}`);
  return source.slice(a, b);
};

test("wallet refresh commits entries and balance only after both queries succeed", () => {
  const refresh = section("const load = async () => {", "void load();");
  assert.ok(refresh.indexOf("if (balanceError) throw balanceError") < refresh.indexOf("setEntries(allEntries)"));
  assert.ok(refresh.includes("requestId === latestRequest"));
  assert.ok(refresh.includes("setError(\"\")"));
});

test("wallet operations guard against pending mutations and refreshes", () => {
  assert.ok(section("const addEntry = async", "const saveOpeningBalance = async").includes("if (saving || balanceSaving || loading) return"));
  assert.ok(section("const saveOpeningBalance = async", "const deleteEntry = async").includes("if (saving || balanceSaving || loading) return"));
  assert.ok(section("const deleteEntry = async", "return (").includes("if (saving || balanceSaving || loading) return"));
  assert.ok(source.includes("disabled={saving || balanceSaving || loading} onClick={() => void deleteEntry(item.id)}"));
});

test("wallet retries failed refresh and preserves visible records", () => {
  assert.ok(source.includes("setRefreshAttempt(previous => previous + 1)"));
  assert.ok(source.includes("setError(\"Não foi possível atualizar os dados financeiros."));
  assert.ok(source.includes("window.addEventListener(\"myryra:finance-updated\", refresh)"));
});

test("wallet only publishes confirmed mutations", () => {
  const add = section("const addEntry = async", "const saveOpeningBalance = async");
  assert.ok(add.indexOf("if (!data) throw") < add.indexOf("setEntries(previous => [data as Entry, ...previous])"));
  const balance = section("const saveOpeningBalance = async", "const deleteEntry = async");
  assert.ok(balance.indexOf("if (!savedBalance") < balance.indexOf("setOpeningBalanceCents(cents)"));
});

test("wallet balance and entry controls share the same concurrency guard", () => {
  const guard = "saving || balanceSaving || loading";
  assert.ok(source.includes(`disabled={${guard}} onClick={() => void deleteEntry(item.id)}`));
  assert.ok(source.includes(`disabled={${guard}} className="rounded-xl bg-violet-600 px-4 py-3`));
  assert.ok(source.includes(`disabled={${guard}} className="rounded-xl bg-violet-600 px-4 py-2`));
});

test("wallet paginates all records for balance while limiting visible ledger", () => {
  assert.ok(source.includes("const allEntries: Entry[] = []"));
  assert.ok(source.includes(".range(offset, offset + pageSize - 1)"));
  assert.ok(source.includes("if (!page || page.length < pageSize) break"));
  assert.ok(source.includes("setEntries(allEntries)"));
  assert.ok(source.includes("entries.slice(0, 200).map(item =>"));
});

test("wallet refresh does not overwrite an unsaved opening balance draft", () => {
  assert.ok(source.includes("const openingBalanceDraftDirty = useRef(false)"));
  assert.ok(source.includes("if (!openingBalanceDraftDirty.current) setOpeningBalanceInput("));
  assert.ok(source.includes("openingBalanceDraftDirty.current = true; setOpeningBalanceInput(event.target.value)"));
  assert.ok(source.includes("openingBalanceDraftDirty.current = false;"));
});

test("obsolete paginated refresh stops before requesting further pages", () => {
  const refresh = section("const load = async () => {", "void load();");
  const staleGuard = "if (!mounted || requestId !== latestRequest) return;";
  assert.ok(refresh.includes(staleGuard));
  assert.ok(refresh.indexOf(staleGuard) < refresh.indexOf("allEntries.push("));
  assert.ok(refresh.indexOf("allEntries.push(") < refresh.indexOf("if (!page || page.length < pageSize) break"));
});

test("wallet warns when historical figures are refreshing", () => {
  assert.ok(source.includes('role="status" aria-live="polite"'));
  assert.ok(source.includes("Atualizando histórico e saldo estimado."));
  assert.ok(source.includes("Os valores exibidos podem ser da consulta anterior."));
});
