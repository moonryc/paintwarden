# Support bundles and bug reports

Settings → Help / About offers an opt-in preview before saving diagnostics. Nothing is uploaded. Review the saved file before attaching it to a public issue. The repository must be public (or you must have access) to open its issue form.

## Included

- App version, OS family, local/remote connection mode and selected language.
- Connected server version when available. Desktop startup/migration phase; the browser reports migration state as unavailable.
- Desktop ZIP: up to four bounded rotating logs each for the bundled server and desktop failures, plus `summary.json` with recent error **categories**. In remote mode these are this desktop's logs, not the remote server's logs; earlier local-session event categories may be present.
- Browser/Docker: a JSON summary only. This version intentionally has **no server-log download endpoint**, even for the owner. Browser clients cannot read host logs or migration state. An owner may inspect server logs locally, but should not paste or attach raw logs.

## Redaction model

Raw logs are private local recovery material and can contain setup codes, credentials, SQL, paths and vault content. The exported logs are a **fail-closed projection**, not a regex best effort: only fixed startup phases and coarse error categories survive; all free text, stack traces, SQL, URLs, identifiers and unknown lines are omitted. Home paths are removed entirely (rather than sharing even a `~/…` suffix that might contain a vault name). No email addresses, cookies, authorization headers, tokens, passwords/hashes, setup codes, paint/miniature names, notes or data files are exported. Adding richer log fields requires a new allowlist and privacy tests. The fixture test covers each sensitive kind and malformed/future lines.

Raw logs remain on the user's device, with existing bounded rotation (2 MiB each, three rotated copies per stream). Export reads only these fixed filenames, refuses symlinks, caps each read, limits output to 2,000 event lines per file, and never reads the database, images, preferences, session store, environment or arbitrary files. The desktop save dialog writes only the redacted ZIP. Cancellation writes nothing.

## Report a bug

Settings, the app crash screen, and desktop startup recovery offer the GitHub bug-report form. The URL contains **only** the issue template and validated app version, OS family, mode and language. No log text, server address, error message, vault data or credentials are sent in the URL. Desktop constructs the URL in the main process, verifies an exact HTTPS GitHub path/query allowlist, and opens it with `shell.openExternal`; the renderer cannot supply an arbitrary URL. The browser uses `window.open` with `noopener,noreferrer`.
