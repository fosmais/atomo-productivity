# Journey + MIKA Universal — P0 implementation contract

## Problem
A Journey for learning Italian showed generic missions and MYRA rewards without offering teaching sessions or scheduling them. The same gap applies to any user-defined goal.

## Required behavior
1. On Journey creation, infer goal, desired outcome, topic, skill level, constraints, preferred cadence, timezone and optional deadline. Ask only missing essential details. Never invent dates or assume availability.
2. Generate goal-specific milestones, weekly missions, daily actions, measurable success criteria and an adaptive session plan. Reject vague steps such as "identify an obstacle" as the only actionable lesson.
3. Present a clear **Schedule sessions** action. Read MYRYRA availability; propose free slots, ask for explicit confirmation, persist linked events/tasks with idempotency keys, and optionally sync to Google Calendar only with the user's connected authorization. Show failure/retry states and avoid duplicates.
4. Present **Start with MIKA** on every scheduled or ad-hoc session. Pass the real Journey goal, level, current milestone, lesson topic, past progress, user language and duration into MIKA's conversation context. MIKA must actively teach, coach, quiz, practice, explain and adapt, rather than merely summarize a mission.
5. MIKA is a general-purpose assistant for **any topic** (learning, work, technology, arts, languages, fitness, personal projects and more). No hardcoded Italian-only branches, fixed catalog or persona lock. Select a suitable teaching/coaching strategy dynamically and admit uncertainty; for high-stakes subjects avoid overconfident personalized instructions.
6. Record completion only on a meaningful user action or evaluated activity. Award MYRAs exactly once per eligible validated achievement, using server-side deduplication and authorization. Never award solely for viewing a screen.
7. Journey edits, pauses, resumes and deletes must reconcile linked future sessions with user confirmation; never silently delete unrelated calendar entries.
8. Preserve existing validated flows, permissions, RLS, privacy and mobile card-first UX. Never write to external apps without user authorization.

## Suggested modular interfaces
- generateJourneyPlan({goal, context, preferences}) -> validated structured milestones, lessons and successCriteria
- proposeJourneySessions({journeyId, cadence, timezone}) -> candidate slots, no writes
- confirmJourneySessions({journeyId, selectedSlots, syncGoogle}) -> idempotent linked calendar events
- startMikaSession({journeyId, lessonId}) -> context-aware interactive conversation
- evaluateJourneyActivity({journeyId, lessonId, evidence}) -> feedback and verified progress
- grantMyraOnce({userId, achievementId}) -> transaction-safe reward

Use strict structured output for plan generation and explicit tool calling for app actions. Server-side permissions and validation are mandatory.

## Acceptance tests
- Beginner Italian: personalized A1 plan, three suggested 20-minute lessons (not created until confirmation), MIKA teaches greetings interactively, progress updates only after practice.
- Other topics: running 10 km, saving money, learning Python, photography, changing country, cooking. Each generates different real activities and MIKA can discuss the topic deeply.
- Calendar: availability conflicts, no Google authorization, retries, duplicate submissions, timezone changes, pause/resume/edit/delete.
- Rewards: repeated clicks, concurrent requests, invalid evidence, unauthorized users.
- Mobile: accessible compact cards, working navigation and loading/error states.
- Regression: existing Journey, Agenda, Tasks, MIKA, Finance and billing flows unchanged.

## Release gate
Implement and verify on Preview; run automated tests and user acceptance tests. Do not merge or deploy to production without evidence of passing checks. No changes to payment settings.
