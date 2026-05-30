<!--
SPDX-License-Identifier: GPL-3.0-only
Copyright (C) 2026 Cursor Boston
-->

# `scripts/_lib` — shared harness for one-off scripts

Before this existed, every `send-*` script re-implemented the same ~150 lines of
boilerplate (env loading, `escapeHtml`, `sleep`, CLI flag parsing, a recipient
query, a dry-run preview, and a throttled send loop with per-recipient
try/catch + an idempotency stamp). Backfill/seed/sync scripts likewise
re-implemented batched writes and the `--dry-run`/`--apply` branch.

These modules own that boilerplate so a script only supplies what is actually
unique to it.

## Modules

| Module | Use it for |
| --- | --- |
| `script-utils.ts` | `loadEnv()`, `escapeHtml()`, `sleep()`, `parseSendArgs()`, `parseDbArgs()`, `requireFirebaseEnv()`, `requireMailgunEnv()` |
| `campaign-runner.ts` | `runEmailCampaign()` — the full `send-*` lifecycle |
| `db-runner.ts` | `runBackfill()` — batched Firestore writes for `backfill-*`/`seed-*`/`sync-*` |
| `cohort1-recipients.ts` | domain helper: load admitted cohort-1 applicants by idempotency stamp |

> **Import order matters.** `loadEnv()` (or any env-reading import) must run
> before modules that read `process.env` at import time. Put
> `import { loadEnv, ... } from "./_lib/script-utils"; loadEnv();` at the very
> top, before importing `../lib/*`.

## Writing a new email campaign

```ts
import { loadEnv, escapeHtml, parseSendArgs } from "./_lib/script-utils";
loadEnv();

import { runEmailCampaign, type EmailContent } from "./_lib/campaign-runner";
// ...domain imports...

interface Recipient { email: string; firstName: string; /* ... */ }

function buildEmail(r: Recipient): EmailContent {
  // return { subject, html, text }  (add `from` for a per-campaign sender)
}

async function main() {
  await runEmailCampaign<Recipient>({
    args: parseSendArgs(),
    name: "My campaign",
    getEmail: (r) => r.email,
    buildEmail,
    loadRecipients: async ({ db, args }) => { /* query + filter */ },
    onSent: (r, { db }) => { /* optional idempotency stamp */ },
    // beforeSend, throttleMs, previewMode, progressEvery are optional
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Worked examples in `scripts/`:

- `send-cohort-admittance.ts` — per-recipient user lookup + `--force`/`--only-email`
- `send-cohort1-week3-*.ts` — share `cohort1-recipients.ts` for the recipient filter
- `send-may26-event-morning.ts` — multi-collection dedup, `from` override, `beforeSend`

## Writing a new backfill/seed/sync

```ts
import { loadEnv, parseDbArgs } from "./_lib/script-utils";
loadEnv();
import { runBackfill, type WriteOp } from "./_lib/db-runner";

await runBackfill({
  args: parseDbArgs(process.argv.slice(2), ["--write"]),
  name: "my backfill",
  load: async ({ db }) => { /* return the docs/items to process */ },
  process: (item): WriteOp | null => /* a write op, or null to skip */,
});
```

Worked example: `backfill-attending-confirmed-by.ts`.

## Scope note

The pre-existing dated one-off `send-*` scripts (e.g. `send-broadcast-2026-05-*`,
`send-cohort1-week2-*`) were executed once and archived; they were intentionally
**not** migrated, since rewriting executed-once templates is churn with no payoff.
New scripts and re-runnable ones should use this harness.
