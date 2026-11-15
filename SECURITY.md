# Security policy

## Report a vulnerability privately

For a suspected Paintwarden security vulnerability, use this repository's **Security → Report a vulnerability** ([private vulnerability reporting](https://github.com/moonryc/paintwarden/security/advisories/new)). Do not post security details in public issues, discussions or pull requests. If the private-report option is unavailable, wait for it to be enabled rather than publishing the details.

Ordinary bugs and feature requests belong in [GitHub Issues](https://github.com/moonryc/paintwarden/issues). See [CONTRIBUTING.md](CONTRIBUTING.md) for contributions.

## Scope and supported versions

Security fixes target the **latest published beta**. The first planned beta is `1.0.0-beta.1`; older betas and unreleased development snapshots are not supported. Include your exact app and server versions and whether you use desktop local mode, a remote server or Docker.

Reports may cover the desktop application, web interface, server/API, authentication, backups, plugin handling or release/update process. Third-party plugins and dependencies can affect users too: identify the component and version so the report can be directed appropriately. Do not assume third-party plugin data is trusted or endorsed.

## Safe reporting

- Test only on systems and data you own or have explicit permission to assess. Prefer an isolated test vault with fictitious data.
- Include a clear description, affected versions, potential impact and minimal reproduction steps. Share a proof of concept privately if useful.
- Never include passwords, tokens, cookies, setup codes, private server addresses, real vault contents or personal photos. Review and redact any optional support bundle before sharing it.
- Do not access other people's accounts or data, disrupt services, perform denial-of-service tests or publish exploit details before coordinated disclosure.

The project does not promise a response deadline or a bounty. Please keep further vulnerability discussion in the private report while a fix and disclosure are coordinated.
