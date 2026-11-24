const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const route = fs.readFileSync(path.join(__dirname, '../src/app/api/mika/actions/route.ts'), 'utf8');

test('MIKA concierge requires authenticated ownership for proposals and decisions', () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /\.eq\("id", actionId\)\.eq\("user_id", user\.id\)\.eq\("status", "awaiting_authorization"\)/);
  assert.match(route, /\.eq\("id", eventId\)\.eq\("user_id", user\.id\)/);
});

test('MIKA concierge approval is not represented as external execution', () => {
  assert.match(route, /executed: false/);
  assert.match(route, /status: "awaiting_authorization"/);
  assert.match(route, /decision === "authorize" \? "authorized" : "cancelled"/);
  assert.doesNotMatch(route, /fetch\s*\(\s*["'`]https?:\/\//);
});

test('MIKA concierge disallows unauthenticated mutations and validates inputs', () => {
  assert.match(route, /if \(!user\) return NextResponse\.json\(\{ error: "Acesso não autorizado\." \}, \{ status \}\)/);
  assert.match(route, /content-type/);
  assert.match(route, /JSON\.stringify\(proposal\)\.length > 4000/);
  assert.match(route, /decision !== "authorize" && decision !== "cancel"/);
});
