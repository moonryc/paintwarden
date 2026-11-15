# Contributing

## Security reports

For a suspected security vulnerability, follow [SECURITY.md](SECURITY.md) and report privately, not in a public issue or pull request.

## Development setup

Use the Node version in `.nvmrc` (currently 22.22.2), then run `npm ci`.
See the [README](README.md) for development commands, [AGENTS.md](AGENTS.md)
for repository guidelines, and [docs/code-quality.md](docs/code-quality.md)
for quality gates. Before submitting, run `npm run lint`, `npm run typecheck`,
`npm test`, `npm run build`, `npm run format:check`, `npm run codegen:check`,
`npm run storybook:test`, `npm run i18n:check`, and `npm run audit:production`.

Follow [docs/i18n.md](docs/i18n.md) for UI strings: update all 13 languages and
run the i18n check. Keep legal text in English.

To avoid publishing your personal email in commits, configure your own GitHub
no-reply email with `git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"` and verify
it with `git config user.email` before committing.

## Contributor License Agreement (CLA)

By submitting a contribution to Paintwarden, you agree that:

- You grant Ryan Moon a non-exclusive, perpetual, worldwide, irrevocable,
  royalty-free license to use, reproduce, modify, distribute, sublicense, and
  relicense your contribution under any terms, including commercial terms.
- You have the right to submit the contribution and to grant this license.
  If permission from an employer or another rights holder is needed, you have it.
- You retain your own copyright in your contribution. This agreement does not
  transfer ownership of that copyright.

These contribution terms allow Ryan Moon to offer the project under other
licenses, including commercial licenses. The project's current public license
is [PolyForm Noncommercial 1.0.0](LICENSE).
