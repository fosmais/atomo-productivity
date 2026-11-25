#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- standalone staging-only harness */
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
const env = process.env;
const URL = "https://xanavauqzsrgvdfhcrsm.supabase.co";
const required = ["MYRYRA_FINANCE_STAGING_ANON_KEY","FINANCE_TEST_EMAIL","FINANCE_TEST_PASSWORD","FINANCE_TEST_OTHER_EMAIL","FINANCE_TEST_OTHER_PASSWORD"];
const missing = required.filter((key) => !env[key]);
if (missing.length) throw new Error("Missing staging-only settings: " + missing.join(", "));
if (env.MYRYRA_FINANCE_STAGING_ANON_KEY.startsWith("sb_secret_")) throw new Error("Service-role/secret key is forbidden");
for (const key of ["FINANCE_TEST_EMAIL","FINANCE_TEST_OTHER_EMAIL"]) {
  if (!/^finance-staging-test[+._a-z0-9-]*@[^@]+\\.[^@]+$/i.test(env[key])) throw new Error("Only dedicated finance-staging-test synthetic accounts are allowed");
}
assert.notEqual(env.FINANCE_TEST_EMAIL.toLowerCase(), env.FINANCE_TEST_OTHER_EMAIL.toLowerCase());
const makeClient = () => createClient(URL, env.MYRYRA_FINANCE_STAGING_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
async function login(email, password) {
  const client = makeClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user || !data?.session) throw new Error("Synthetic staging sign-in failed");
  const { data: identity, error: identityError } = await client.auth.getUser(data.session.access_token);
  if (identityError || identity?.user?.id !== data.user.id || identity.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Staging Auth identity verification failed");
  }
  return { client, userId: data.user.id };
}
async function main() {
  const [a, b] = await Promise.all([
    login(env.FINANCE_TEST_EMAIL, env.FINANCE_TEST_PASSWORD),
    login(env.FINANCE_TEST_OTHER_EMAIL, env.FINANCE_TEST_OTHER_PASSWORD),
  ]);
  assert.notEqual(a.userId, b.userId, "Two distinct Auth users are required");
  const runTag = "[MYRYRA-STAGING-RLS] " + new Date().toISOString() + " " + Math.random().toString(36).slice(2, 9);
  const created = [];
  async function add(owner, suffix) {
    const { data, error } = await owner.client.from("myryra_finance_entries")
      .insert({ description: runTag + " " + suffix, amount_cents: 1000, kind: "income" })
      .select("id,user_id,description,amount_cents,kind,deleted_at").single();
    if (error) throw error;
    assert.equal(data.user_id, owner.userId);
    created.push({ owner, id: data.id });
    return data;
  }
  const rowA = await add(a, "A");
  const rowB = await add(b, "B");

  const ownRead = await a.client.from("myryra_finance_entries").select("id,user_id,amount_cents,deleted_at").eq("id", rowA.id).single();
  if (ownRead.error) throw ownRead.error;
  assert.equal(ownRead.data.user_id, a.userId, "Owner must read own entry");

  const ownEdit = await a.client.from("myryra_finance_entries")
    .update({ description: runTag + " A edited", amount_cents: 1250 }).eq("id", rowA.id).select("id,amount_cents").single();
  if (ownEdit.error) throw ownEdit.error;
  assert.equal(Number(ownEdit.data.amount_cents), 1250, "Owner edit must persist");

  const foreignRead = await a.client.from("myryra_finance_entries").select("id").eq("id", rowB.id);
  if (foreignRead.error) throw foreignRead.error;
  assert.equal(foreignRead.data.length, 0, "User A must not read User B entry");

  const foreignEdit = await a.client.from("myryra_finance_entries")
    .update({ amount_cents: 999999 }).eq("id", rowB.id).select("id");
  if (foreignEdit.error) {
    assert.match(foreignEdit.error.code || "", /^(42501|PGRST301)$/, "Unexpected cross-user update error");
  } else {
    assert.equal(foreignEdit.data.length, 0, "Cross-user update must affect zero rows");
  }
  const unchanged = await b.client.from("myryra_finance_entries").select("amount_cents").eq("id", rowB.id).single();
  if (unchanged.error) throw unchanged.error;
  assert.equal(Number(unchanged.data.amount_cents), 1000, "Cross-user update changed the other user's entry");

  const softDelete = await a.client.from("myryra_finance_entries")
    .update({ deleted_at: new Date().toISOString() }).eq("id", rowA.id).select("id,deleted_at").single();
  if (softDelete.error) throw softDelete.error;
  assert.ok(softDelete.data.deleted_at, "Soft delete timestamp must persist");
  const hidden = await a.client.from("myryra_finance_entries").select("id").eq("id", rowA.id).is("deleted_at", null);
  if (hidden.error) throw hidden.error;
  assert.equal(hidden.data.length, 0, "Soft-deleted entry must leave active ledger");
  const inTrash = await a.client.from("myryra_finance_entries").select("id").eq("id", rowA.id).not("deleted_at", "is", null);
  if (inTrash.error) throw inTrash.error;
  assert.equal(inTrash.data.length, 1, "Owner must see own entry in trash");

  const restored = await a.client.from("myryra_finance_entries")
    .update({ deleted_at: null }).eq("id", rowA.id).select("id,deleted_at").single();
  if (restored.error) throw restored.error;
  assert.equal(restored.data.deleted_at, null, "Restore must return entry to active ledger");

  // Leave only clearly tagged synthetic fixtures, soft-deleted, so reruns cannot pollute balances.
  await Promise.all(created.map(async ({ owner, id }) => {
    const { error } = await owner.client.from("myryra_finance_entries")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }));
  await Promise.all([a.client.auth.signOut(), b.client.auth.signOut()]);
  console.log("PASS: two authenticated staging users; owner read/edit; cross-user read/update denied; soft delete; trash visibility; restore; synthetic rows archived");
}
main().catch((error) => {
  console.error("Finance staging RLS test failed:", error.message);
  process.exitCode = 1;
});
