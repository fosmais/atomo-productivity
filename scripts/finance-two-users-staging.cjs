#!/usr/bin/env node
/**
 * Two-user Finance RLS and soft-delete integration test.
 * Staging only. Requires two dedicated synthetic Supabase Auth identities.
 * Uses the public/publishable key only; never service_role.
 *
 * MYRYRA_FINANCE_STAGING_URL=https://xanavauqzsrgvdfhcrsm.supabase.co
 * MYRYRA_FINANCE_STAGING_ANON_KEY=...
 * FINANCE_TEST_EMAIL / FINANCE_TEST_PASSWORD
 * FINANCE_TEST_OTHER_EMAIL / FINANCE_TEST_OTHER_PASSWORD
 */
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");

const env = process.env;
const STAGING_URL = "https://xanavauqzsrgvdfhcrsm.supabase.co";
const required = [
  "MYRYRA_FINANCE_STAGING_URL",
  "MYRYRA_FINANCE_STAGING_ANON_KEY",
  "FINANCE_TEST_EMAIL",
  "FINANCE_TEST_PASSWORD",
  "FINANCE_TEST_OTHER_EMAIL",
  "FINANCE_TEST_OTHER_PASSWORD",
];
const missing = required.filter(key => !env[key]);
if (missing.length) throw new Error("Missing staging-only settings: " + missing.join(", "));
if (env.MYRYRA_FINANCE_STAGING_URL !== STAGING_URL) throw new Error("Refusing to run outside the approved Finance staging project");
if (env.MYRYRA_FINANCE_STAGING_ANON_KEY.startsWith("sb_secret_")) throw new Error("Secret/service-role keys are forbidden");
for (const key of ["FINANCE_TEST_EMAIL", "FINANCE_TEST_OTHER_EMAIL"]) {
  if (!/^myryra-finance-test[+._a-z0-9-]*@[^@]+\.[^@]+$/i.test(env[key])) {
    throw new Error("Use dedicated myryra-finance-test... synthetic identities");
  }
}
assert.notEqual(env.FINANCE_TEST_EMAIL.toLowerCase(), env.FINANCE_TEST_OTHER_EMAIL.toLowerCase());

const makeClient = () => createClient(STAGING_URL, env.MYRYRA_FINANCE_STAGING_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
async function signIn(email, password) {
  const client = makeClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user || !data?.session) throw new Error("Synthetic Finance staging sign-in failed");
  return { client, user: data.user };
}
function assertNoRowsOrDenied(result, label) {
  if (result.error) {
    assert.match(result.error.code || "", /^(42501|PGRST301)$/i, label + ": unexpected authorization error");
  } else {
    assert.equal(result.data?.length ?? 0, 0, label + ": another user's data was exposed or modified");
  }
}

(async () => {
  let a, b;
  const cleanup = { entries: [], subscriptions: [] };
  try {
    [a, b] = await Promise.all([
      signIn(env.FINANCE_TEST_EMAIL, env.FINANCE_TEST_PASSWORD),
      signIn(env.FINANCE_TEST_OTHER_EMAIL, env.FINANCE_TEST_OTHER_PASSWORD),
    ]);
    assert.notEqual(a.user.id, b.user.id, "Two distinct Auth identities are required");

    const tag = "[MYRYRA-FINANCE-STAGING-TEST] " + crypto.randomUUID();
    const { data: entry, error: entryError } = await a.client.from("myryra_finance_entries")
      .insert({ user_id: a.user.id, description: tag, amount_cents: 1234, kind: "expense" })
      .select("id,user_id,description,amount_cents,kind,deleted_at").single();
    if (entryError) throw entryError;
    cleanup.entries.push(entry.id);
    assert.equal(entry.user_id, a.user.id);
    assert.equal(entry.amount_cents, 1234);

    const { data: sub, error: subError } = await a.client.from("myryra_finance_subscriptions")
      .insert({ user_id: a.user.id, title: tag, amount_cents: 299, billing_cycle: "monthly", next_due_date: "2099-01-01" })
      .select("id,user_id,title,amount_cents,billing_cycle,next_due_date,deleted_at").single();
    if (subError) throw subError;
    cleanup.subscriptions.push(sub.id);
    assert.equal(sub.user_id, a.user.id);

    const foreignEntry = await b.client.from("myryra_finance_entries")
      .select("id").eq("id", entry.id);
    assertNoRowsOrDenied(foreignEntry, "cross-user entry SELECT");
    const foreignSub = await b.client.from("myryra_finance_subscriptions")
      .select("id").eq("id", sub.id);
    assertNoRowsOrDenied(foreignSub, "cross-user subscription SELECT");

    const foreignEntryUpdate = await b.client.from("myryra_finance_entries")
      .update({ amount_cents: 9999 }).eq("id", entry.id).select("id");
    assertNoRowsOrDenied(foreignEntryUpdate, "cross-user entry UPDATE");
    const foreignSubUpdate = await b.client.from("myryra_finance_subscriptions")
      .update({ amount_cents: 9999 }).eq("id", sub.id).select("id");
    assertNoRowsOrDenied(foreignSubUpdate, "cross-user subscription UPDATE");

    const { data: updatedEntry, error: updateEntryError } = await a.client.from("myryra_finance_entries")
      .update({ amount_cents: 2345 }).eq("id", entry.id).eq("user_id", a.user.id)
      .select("id,amount_cents").single();
    if (updateEntryError) throw updateEntryError;
    assert.equal(updatedEntry.amount_cents, 2345, "owner entry edit must persist");

    const deletedAt = new Date().toISOString();
    const { data: trashed, error: trashError } = await a.client.from("myryra_finance_entries")
      .update({ deleted_at: deletedAt }).eq("id", entry.id).eq("user_id", a.user.id)
      .select("id,deleted_at").single();
    if (trashError) throw trashError;
    assert.ok(trashed.deleted_at, "soft delete timestamp must persist");
    const activeRead = await a.client.from("myryra_finance_entries").select("id")
      .eq("id", entry.id).is("deleted_at", null);
    if (activeRead.error) throw activeRead.error;
    assert.equal(activeRead.data.length, 0, "trashed entry must be excluded from active wallet");
    const trashRead = await a.client.from("myryra_finance_entries").select("id")
      .eq("id", entry.id).not("deleted_at", "is", null);
    if (trashRead.error) throw trashRead.error;
    assert.equal(trashRead.data.length, 1, "owner must be able to recover trashed entry");

    const { data: restored, error: restoreError } = await a.client.from("myryra_finance_entries")
      .update({ deleted_at: null }).eq("id", entry.id).eq("user_id", a.user.id)
      .select("id,deleted_at").single();
    if (restoreError) throw restoreError;
    assert.equal(restored.deleted_at, null, "restore must clear deleted_at");

    const { data: updatedSub, error: updateSubError } = await a.client.from("myryra_finance_subscriptions")
      .update({ amount_cents: 399 }).eq("id", sub.id).eq("user_id", a.user.id)
      .select("id,amount_cents").single();
    if (updateSubError) throw updateSubError;
    assert.equal(updatedSub.amount_cents, 399, "owner subscription edit must persist");

    const { data: trashedSub, error: trashSubError } = await a.client.from("myryra_finance_subscriptions")
      .update({ deleted_at: new Date().toISOString() }).eq("id", sub.id).eq("user_id", a.user.id)
      .select("id,deleted_at").single();
    if (trashSubError) throw trashSubError;
    assert.ok(trashedSub.deleted_at, "subscription soft delete must persist");
    const foreignTrash = await b.client.from("myryra_finance_subscriptions")
      .select("id").eq("id", sub.id).not("deleted_at", "is", null);
    assertNoRowsOrDenied(foreignTrash, "cross-user trash SELECT");

    const { data: restoredSub, error: restoreSubError } = await a.client.from("myryra_finance_subscriptions")
      .update({ deleted_at: null }).eq("id", sub.id).eq("user_id", a.user.id)
      .select("id,deleted_at").single();
    if (restoreSubError) throw restoreSubError;
    assert.equal(restoredSub.deleted_at, null, "subscription restore must clear deleted_at");

    console.log(JSON.stringify({
      project: "xanavauqzsrgvdfhcrsm",
      result: "PASS",
      checks: [
        "two distinct Supabase Auth users",
        "cross-user entry/subscription reads denied",
        "cross-user entry/subscription updates denied",
        "owner entry edit persisted in integer cents",
        "entry soft delete, active-list exclusion and restore",
        "owner subscription edit, soft delete and restore",
      ],
      cleanup: "synthetic rows removed in finally",
    }, null, 2));
  } finally {
    if (a) {
      for (const id of cleanup.entries) await a.client.from("myryra_finance_entries").delete().eq("id", id).eq("user_id", a.user.id);
      for (const id of cleanup.subscriptions) await a.client.from("myryra_finance_subscriptions").delete().eq("id", id).eq("user_id", a.user.id);
      await a.client.auth.signOut();
    }
    if (b) await b.client.auth.signOut();
  }
})().catch(error => {
  console.error("Finance staging integration failed:", error?.message || "unknown error");
  process.exitCode = 1;
});
