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
  assert.ok(section("const addEntry = async", "const saveOpeningBalance = async").includes("if (saving || balanceSaving || loading || error) return"));
  assert.ok(section("const saveOpeningBalance = async", "const deleteEntry = async").includes("if (saving || balanceSaving || loading || error) return"));
  assert.ok(section("const deleteEntry = async", "return (").includes("if (saving || balanceSaving || loading || error) return"));
  assert.ok(source.includes("disabled={saving || balanceSaving || loading || Boolean(error)} onClick={() => void deleteEntry(item.id)}"));
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
  const guard = "saving || balanceSaving || loading || Boolean(error)";
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

test("wallet rejects invalid persisted entries before publishing a new balance", () => {
  const refresh = section("const load = async () => {", "void load();");
  assert.ok(refresh.includes("Number.isSafeInteger(item.amount_cents)"));
  assert.ok(refresh.includes('item.amount_cents <= 0'));
  assert.ok(refresh.includes('["income", "expense"].includes(item.kind)'));
  assert.ok(refresh.indexOf("Histórico financeiro inválido.") < refresh.indexOf("setEntries(allEntries)"));
});

test("invalid opening balance never partially commits refreshed ledger", () => {
  const refresh = section("const load = async () => {", "void load();");
  assert.ok(refresh.includes('if (!Number.isSafeInteger(nextBalance)) throw new Error("Saldo inicial inválido.")'));
  assert.ok(refresh.indexOf('if (!Number.isSafeInteger(nextBalance))') < refresh.indexOf("setEntries(allEntries)"));
});

test("wallet refuses unsafe aggregated balances before updating visible records", () => {
  const refresh = section("const load = async () => {", "void load();");
  assert.ok(refresh.includes("calculateBalanceCents(nextBalance, allEntries) === null"));
  assert.ok(refresh.indexOf("calculateBalanceCents(nextBalance, allEntries) === null") < refresh.indexOf("setEntries(allEntries)"));
});

test("finance deletion requires explicit confirmation before database mutation", () => {
  const deletion = section("const deleteEntry = async (id: string) => {", "return (");
  assert.ok(deletion.includes("window.confirm("));
  assert.ok(deletion.includes("A exclusão é definitiva e não pode ser desfeita."));
  assert.ok(deletion.includes("Você poderá restaurá-lo na lixeira."));
  assert.ok(deletion.indexOf("window.confirm(") < deletion.indexOf("setSaving(true)"));
  assert.ok(deletion.indexOf("window.confirm(") < deletion.indexOf('.delete().eq("id", id)'));
});

test("failed wallet refresh warns before presenting potentially stale balance", () => {
  const warning = source.indexOf("Atenção: não foi possível confirmar o saldo atual.");
  const balance = source.indexOf("Saldo estimado</p>");
  assert.ok(warning >= 0 && balance > warning);
  assert.ok(source.includes("{!loading && error && <p role=\"alert\""));
  assert.ok(source.includes("Use “Tentar novamente”"));
});

test("opening balance save rejects totals outside safe integer range before upsert", () => {
  const save = section("const saveOpeningBalance = async", "const deleteEntry = async");
  assert.ok(save.includes("calculateBalanceCents(cents, entries) === null"));
  assert.ok(save.indexOf("calculateBalanceCents(cents, entries) === null") < save.indexOf(".upsert("));
});

test("new transaction is checked against complete wallet before insert", () => {
  const add = section("const addEntry = async", "const saveOpeningBalance = async");
  assert.ok(add.includes("calculateBalanceCents(openingBalanceCents, [...entries,"));
  assert.ok(add.indexOf("calculateBalanceCents(openingBalanceCents, [...entries,") < add.indexOf(".insert("));
});

test("wallet prevents mutations while financial data is stale", () => {
  for (const [start, end] of [
    ["const addEntry = async", "const saveOpeningBalance = async"],
    ["const saveOpeningBalance = async", "const deleteEntry = async"],
    ["const deleteEntry = async", "  return ("],
  ]) {
    assert.ok(section(start, end).includes("if (saving || balanceSaving || loading || error) return;"));
  }
  assert.equal((source.match(/disabled=\{saving \|\| balanceSaving \|\| loading \|\| Boolean\(error\)\}/g) ?? []).length, 4);
});

test("wallet verifies persisted entry matches request before updating local history", () => {
  const add = section("const addEntry = async", "const saveOpeningBalance = async");
  assert.ok(add.includes("data.amount_cents !== cents"));
  assert.ok(add.includes("data.kind !== kind"));
  assert.ok(add.includes("data.description !== name.trim()"));
  assert.ok(add.indexOf("data.amount_cents !== cents") < add.indexOf("setEntries(previous => [data as Entry"));
});

test("wallet detects duplicate entry identifiers across pagination pages", () => {
  const load = section("useEffect(() =>", "const [name, setName]");
  assert.ok(load.includes("const seenEntryIds = new Set<string>()"));
  assert.ok(load.includes("seenEntryIds.has(item.id)"));
  assert.ok(load.includes("seenEntryIds.add(item.id)"));
  assert.ok(load.indexOf("seenEntryIds.has(item.id)") < load.indexOf("allEntries.push(item as Entry)"));
});

test("wallet confirms exact deleted record before removing it from visible history", () => {
  const deletion = section("const deleteEntry = async", "return (");
  assert.ok(deletion.includes("deleted.length !== 1"));
  assert.ok(deletion.includes("deleted[0]?.id !== id"));
  assert.ok(deletion.indexOf("deleted[0]?.id !== id") < deletion.indexOf("setEntries(previous => previous.filter"));
});

test("wallet deletion errors do not falsely flag a stale balance", () => {
  const deletion = section("const deleteEntry = async", "return (");
  assert.ok(deletion.includes('setDeleteError("Não foi possível confirmar a exclusão'));
  assert.ok(!deletion.includes('setError("Não foi possível excluir'));
  assert.ok(source.includes("{deleteError && <p role=\"alert\""));
});

test("wallet reconciles uncertain delete outcome with fresh server data", () => {
  const deletion = section("const deleteEntry = async", "return (");
  assert.ok(deletion.includes('window.dispatchEvent(new Event("myryra:finance-updated"))'));
  const refresh = section("const load = async () => {", "void load();");
  assert.ok(refresh.includes('setDeleteError("")'));
  assert.ok(refresh.indexOf('setEntries(allEntries)') < refresh.indexOf('setDeleteError("")'));
});


test("finance trash is disabled unless explicitly enabled", () => {
  assert.ok(source.includes('NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED === "true"'));
  assert.ok(source.includes('if (trashEnabled) query = query.is("deleted_at", null)'));
  assert.ok(source.includes('trashEnabled && ('));
});

test("finance trash requires owner-scoped confirmed restore", () => {
  const restore = section("const restoreEntry = async", "  return (");
  assert.ok(restore.includes('calculateBalanceCents(openingBalanceCents, [...entries, target])'));
  assert.ok(restore.includes('.eq("user_id", auth.user.id)'));
  assert.ok(restore.includes('.not("deleted_at", "is", null).select("id")'));
  assert.ok(restore.includes("data.length !== 1"));
});
