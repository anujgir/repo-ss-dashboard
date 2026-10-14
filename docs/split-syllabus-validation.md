# Split Syllabus Prototype Validation

Verified locally on 2026-10-14 against the MVC application served by IIS Express. This checks the design prototype, not live SQL reporting or principal approvals.

## Build and Delivery

- JavaScript syntax checked with `node --check Scripts/split-syllabus.js`.
- Visual Studio MSBuild Debug and Release builds use `/p:MvcBuildViews=true` to compile Razor.
- Dashboard, standalone PRD, custom stylesheet, and JavaScript return HTTP 200.
- All six agent files parse as TOML and reference the PRD and supplied domain contract.
- Original root `AGENTS.md` remains unchanged.

## Browser Checks

Automated headless Chrome checks and desktop/mobile screenshot inspection cover:

- Default chart and report include 24 sample districts.
- Started-school, started-teacher, and approved-topic cards reconcile with the district report totals.
- Selecting Ranchi displays five sample blocks directly below the district chart; closing returns focus to the district button.
- Keyboard Enter opens the district drilldown; the PRD's expanded inventory includes all supplied column lists.
- Month, class, subject, cohort, and district filters update the displayed scope. Selecting SOE shows N/A for the excluded other-school cohort.
- January is displayed as January 2027 for academic year 2026-27.
- CSV contains sample-data identification and the applied month/class/district values.
- Reset restores the default scope; report search shows a clear empty result and disables export when nothing matches.
- A sample district with no participation shows zero started teachers and N/A for an empty approval denominator.
- Mobile navigation opens, closes on Escape, and the 390px viewport has no page-level horizontal overflow.
- PRD Next controls and direct step selection update captions and counters.
- No JavaScript page errors or failing HTTP responses were observed in these checks.

## Limits and Next Phase

No SQL connection, controller data logic, approval mutations, or actual teacher/school data exists in this prototype. Production metric validation awaits the SOE identifier, percentage basis, teacher-school assignment source, column types and keys, approval codes, and summary-grain/refresh definitions. The repository still has no automated .NET test project or CI pipeline.
