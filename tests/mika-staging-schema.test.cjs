const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sql = fs.readFileSync(path.join(__dirname, "../docs/sql/mika-agent-staging-proposals.sql"), "utf8");
test("MIKA staging SQL enables RLS and denies browser mutations", () => {
  for (const table of ["mika_action_proposals", "mika_action_audit"]) {
    assert.match(sql, new RegExp("alter table public\\."+table+" enable row level security", "i"));
    assert.match(sql, new RegExp("revoke all on public\\."+table+" from public, anon, authenticated", "i"));
  }
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)\s+on\s+public\.mika_action_/i);
});
test("atomic claim is owner-bound, approved and single-winner", () => {
  assert.match(sql, /where id=p_id and user_id=v_user and approved_by=v_user/i);
  assert.match(sql, /status='approved' and approved_at is not null/i);
  assert.match(sql, /payload_digest=p_digest and expires_at>now\(\)/i);
  assert.match(sql, /returning \* into v_row/i);
  assert.match(sql, /'approved->executing'/);
});
test("no anonymous execute privileges and audit is written in same function", () => {
  for (const name of ["mika_approve_action", "mika_claim_action"]) {
    assert.match(sql, new RegExp("revoke all on function public\\."+name+"\\(uuid,text\\) from public,anon,authenticated", "i"));
    assert.match(sql, new RegExp("grant execute on function public\\."+name+"\\(uuid,text\\) to authenticated", "i"));
  }
  assert.match(sql, /security definer set search_path = ''/i);
  assert.match(sql, /insert into public\.mika_action_audit/i);
});


test("rejection and expiration are owner-bound, terminal and audited", () => {
  assert.match(sql, /function public\.mika_reject_action\(p_id uuid\)/);
  assert.match(sql, /function public\.mika_expire_action\(p_id uuid\)/);
  assert.match(sql, /status='rejected', finished_at=now\(\)/);
  assert.match(sql, /status='expired', finished_at=now\(\)/);
  assert.match(sql, /where id=p_id and user_id=v_user and status in \('proposed','approved'\)/);
  assert.match(sql, /and expires_at<=now\(\)/);
  assert.match(sql, /'user->rejected'/);
  assert.match(sql, /'pending->expired'/);
  for (const name of ["mika_reject_action", "mika_expire_action"]) {
    assert.match(sql, new RegExp("revoke all on function public\\."+name+"\\(uuid\\) from public,anon,authenticated", "i"));
    assert.match(sql, new RegExp("grant execute on function public\\."+name+"\\(uuid\\) to authenticated", "i"));
  }
});
