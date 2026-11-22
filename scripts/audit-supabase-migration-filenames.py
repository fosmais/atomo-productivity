#!/usr/bin/env python3
"""Read-only filename audit for Supabase migration versions. No database access."""
from collections import defaultdict
from pathlib import Path
import sys

root = Path("supabase/migrations")
groups = defaultdict(list)
invalid = []
for path in sorted(root.glob("*.sql")):
    version = path.name.split("_", 1)[0]
    if not version.isdigit() or len(version) != 14:
        invalid.append(path.name)
    groups[version].append(path.name)

collisions = {v: names for v, names in groups.items() if len(names) > 1}
print(f"Migration files: {sum(map(len, groups.values()))}; unique version prefixes: {len(groups)}")
for v, names in sorted(collisions.items()):
    print(f"COLLISION {v}: {', '.join(names)}")
for name in invalid:
    print(f"NONSTANDARD VERSION (expected 14 digits): {name}")
if collisions or invalid:
    print("BLOCKED: migration filenames need explicit reconciliation; do not auto-rename applied migrations.")
    sys.exit(1)
print("PASS: migration filename versions unique and 14 digits")
