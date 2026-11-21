# MYRYRA Finance — staging two-user RLS runbook

## Scope

This workflow tests only the isolated Supabase staging project xanavauqzsrgvdfhcrsm. It never accepts a production URL or a service-role key. It uses two dedicated Auth identities whose email addresses begin with myryra-finance-test.

## GitHub environment secrets

Configure these only in the GitHub environment named staging:

- MYRYRA_FINANCE_STAGING_ANON_KEY: publishable/legacy anon key for the staging project.
- FINANCE_TEST_EMAIL and FINANCE_TEST_PASSWORD: first synthetic user.
- FINANCE_TEST_OTHER_EMAIL and FINANCE_TEST_OTHER_PASSWORD: second synthetic user.

Do not reuse production identities or passwords. Do not add these values to Vercel client variables, repository files, or logs.

## Execution

- Pushes to test/mvp2-finance-wallet-regression trigger the workflow from the default branch.
- Manual dispatch is available from GitHub Actions; choose this branch as test_ref.
- The script signs in as both synthetic users, confirms distinct Auth IDs, checks owner-only reads/writes, edits entries and subscriptions, exercises soft delete/restore, and verifies opening-balance persistence and cross-user isolation.
- The original opening balance is restored. If none existed, the synthetic account is left with a zero opening balance. Synthetic entries and subscriptions are deleted in finally.

## Acceptance

A passing workflow is required before marking Finance two-user RLS as approved. A successful Vercel build or static contract test is not a substitute for this authenticated workflow.
