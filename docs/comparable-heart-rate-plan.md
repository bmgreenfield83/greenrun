# Comparable-workload heart-rate trend

User approved the first analytics recommendation: compare heart rate at similar
running workloads across weeks. HR zones are outside this change.

Implementation plan:

1. Implement and test a pure, versioned steady-section comparison algorithm.
2. Add a read-only endpoint using the last 180 days of stored samples.
3. Add a separate Analytics card with comparison selection, weekly variation,
   contributing activities, and explicit sparse-data states.
4. Document the calculation and run backend/frontend tests, lint, and type checks.

Routine implementation choices: use observed sections rather than extrapolation;
require recorded elevation; compare nearly flat running; keep unknown temperature
separate; respect the existing per-activity HR analysis distance exclusion. Store
no additional personal data and do not change the existing HR-response algorithm.

Status: complete. The pure algorithm, batched read-only endpoint, Analytics card,
documentation, and regression coverage are implemented. Backend and frontend tests,
lint, and TypeScript checks passed. Desktop and mobile Chromium checks passed for
the chart, contributing-run links, and page-width containment; the mobile screenshot
was inspected. Tests use synthetic data; no personal database records were changed.
