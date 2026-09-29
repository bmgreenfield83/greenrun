# v1.1 release checklist

- Run backend tests, Ruff linting, and Ruff formatting checks.
- Run frontend unit tests, ESLint, Prettier, TypeScript, and the production build.
- Run Playwright on desktop Chromium and the mobile Chromium profile.
- Verify calendar legend, planned/completed filters, dense-day "more" behavior, keyboard focus, and mobile toolbar layout.
- Verify batch FIT import with straightforward, duplicate, planned-session, and invalid files.
- Verify active and archived plan exports and confirmation-gated archival.
- Confirm `.env`, credentials, FIT files, backups, Playwright artifacts, and personal exports remain ignored.
- Review setup, backup, import, analytics, and plan-management documentation.

The browser suite mocks API responses and does not replace independent verification against representative personal FIT files and the configured MongoDB instance.
