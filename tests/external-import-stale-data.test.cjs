const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

for (const [provider, file] of [
  ["Google Tasks", "google-tasks-import.tsx"],
  ["Todoist", "todoist-import.tsx"],
]) {
  const source = fs.readFileSync(path.join(__dirname, "../src/app/dashboard", file), "utf8");
  test(provider + " clears stale task selection before refreshing remote data", () => {
    const load = source.slice(source.indexOf("async function load()"), source.indexOf("async function importSelected()"));
    assert.match(load, /setLoaded\(false\)/);
    assert.match(load, /setTasks\(\[\]\)/);
    assert.match(load, /setSelectedIds\(\[\]\)/);
    assert.ok(load.indexOf("setTasks([])") < load.indexOf("await fetch("));
    assert.match(load, /setLoaded\(true\)/);
  });
  test(provider + " requires explicit confirmation before saving imported tasks", () => {
    const save = source.slice(source.indexOf("async function importSelected()"));
    assert.match(save, /window\.confirm\(/);
    assert.match(save, /await saveCloudPlan\(/);
    assert.ok(save.indexOf("window.confirm(") < save.indexOf("await saveCloudPlan("));
  });
}
