# Security Policy

## Reporting Vulnerabilities

Please report security vulnerabilities privately via [GitHub Security Advisories](https://github.com/gendigitalinc/sage/security/advisories/new). Do not open public issues for security bugs.

Include:

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact

We will acknowledge receipt within 10 business days and aim to provide a fix or mitigation plan within 30 days.

## Supported Versions

Only the latest release receives security updates.

## Scope

This policy covers:

- The Sage source code (`packages/`)
- Threat detection rules (`threats/`)
- Build and distribution artifacts (VSIX, SEA binaries)

Third-party dependencies are managed via `pnpm audit` and updated regularly.
