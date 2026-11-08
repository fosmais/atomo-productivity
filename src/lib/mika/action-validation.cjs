// Shared, deterministic validation for model-generated action proposals.
// No user-controlled action is executed by this module.
const TYPES = new Set(["create_task", "create_event", "create_reminder"]);

function isAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { type, title, reason, due_at } = value;
  if (!TYPES.has(type)) return false;
  if (typeof title !== "string" || title.trim().length < 3 || title.length > 160) return false;
  if (typeof reason !== "string" || reason.length > 500) return false;
  if (due_at === null) return true;
  if (typeof due_at !== "string") return false;
  // ISO 8601 timestamp with an explicit UTC offset; reject ambiguous local times.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(due_at)) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(due_at);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , , offsetHour, offsetMinute] = match;
  const y = Number(year), mo = Number(month), d = Number(day);
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || Number(hour) > 23 ||
      Number(minute) > 59 || Number(second) > 59) return false;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > daysInMonth) return false;
  if (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) return false;
  return !Number.isNaN(Date.parse(due_at));
}

function validateProposalList(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !Array.isArray(input.actions)) return null;
  if (input.actions.length === 0 || input.actions.length > 5 || input.actions.some(action => !isAction(action))) return null;
  return input.actions.map(({ type, title, reason, due_at }) =>
    ({ type, title: title.trim(), reason, due_at }));
}

module.exports = { isAction, validateProposalList };
