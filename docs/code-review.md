# Repository Code Review

Review date: 14 October 2026  
Repository: `repo-ss-dashboard`  
Baseline: commit `8d0ec53`, including the current uncommitted dashboard and setup-document changes.

## Assessment and Scope

The application builds successfully in Debug and Release with Razor view compilation enabled. The SQL regression checks and dashboard browser smoke checks pass. Five confirmed issues remain: four medium-priority issues and one low-priority issue. No critical or high-severity vulnerability was demonstrated during this review. This does not establish that the application is ready for production.

The review covered the repository-owned C# controllers and application startup, Razor views and layouts, dashboard JavaScript and CSS, SQL procedure and regression harness, configuration, project manifests, and supporting documentation. Dependency versions and selected maintainer advisories were checked; third-party libraries were not audited line by line.

The current dashboard intentionally uses dummy data. The invocation of `loadSoeCoverage()` is commented out, while the method and endpoint remain available. This follows the latest requested behavior and is not a defect. Arithmetic averages in the SOE procedure and the direct `SqlDataAdapter` controller implementation also follow the requested requirements.

## Findings

### 1. Medium: SOE database failures break the JSON response contract

Location: [SplitSyllabusController.cs](../Controllers/SplitSyllabusController.cs), lines 22–40.

Connection/configuration errors and SQL exceptions escape the action. Calling `/SplitSyllabus/SoeCoverage?academicYearStart=2026&month=10` against the current placeholder configuration returns HTTP 500 with `text/html`, rather than a JSON error response. The dummy connection string is intentional; the missing error handling is the issue.

When live loading is restored, the JavaScript handles this as “No data found,” which conceals the distinction between a database outage and an empty result. Direct API consumers also cannot depend on the JSON response contract.

Recommendation: retain the simple server-call structure, but handle database/configuration failures with an appropriate HTTP status and a safe JSON failure response. Log diagnostic details on the server. Guard missing configuration and unexpected result shapes. The current procedure always returns one aggregate row, so an ordinary empty scope does not itself cause `Rows[0]` to fail.

Verification after correction: exercise SQL failure, missing configuration, empty scope, and successful results; ensure all API responses have a predictable JSON shape without exposing connection details.

### 2. Medium: SOE request filters lack server-side validation

Location: [SplitSyllabusController.cs](../Controllers/SplitSyllabusController.cs), lines 17–31.

The action does not check `ModelState`, the month range, the academic-year range, acceptable batch identifiers, or string lengths before sending values to SQL. A direct request with `month=13` still attempts the database call and returns the same HTML 500 under the current configuration instead of a validation response.

With a live database, invalid filters can produce misleading empty results; overlong names also exceed the declared 200-character SQL parameters. Dropdown restrictions do not protect direct HTTP requests. SQL parameters prevent injection, but do not validate business inputs.

Recommendation: reject invalid requests before opening a connection. Require months 1–12, an agreed supported academic-year range, valid optional batch identifiers, and names within the declared length. Check binding errors and use a JSON HTTP 400 response. Validate against actual master data when the database integration is introduced.

Verification after correction: cover missing/malformed integers, months 0 and 13, overlong strings, and January–March calendar-year conversion.

### 3. Medium: closing block drilldown returns focus to an invisible district

Location: [split-syllabus.js](../Scripts/split-syllabus.js), lines 395–399; `renderDistrictChart()`.

Closing the block panel rebuilds the district chart, resetting its internal scroll position. It then focuses the selected district with `preventScroll: true`. In the browser check, opening Ranchi and closing its block panel left Ranchi focused while the chart had `scrollTop=0`; the focused button was outside the visible chart viewport.

This makes keyboard navigation difficult because users cannot see where focus returned.

Recommendation: preserve the chart scroll position and originating district button, avoid rebuilding unaffected rows, or explicitly scroll the returned focused district into view. Verify with districts near the bottom of the list and after changing sort order.

### 4. Medium: several small-text styles have insufficient contrast

Location: [split-syllabus.css](../Content/split-syllabus.css), line 2, selectors below. Ratios were calculated from browser-computed foreground/background colors.

| Selector | Text/background | Font size | Contrast |
| --- | --- | --- | --- |
| `.panel-eyebrow` | `#7e939d` / `#ffffff` | 8px | 3.21:1 |
| `.district-table thead th` | `#758a94` / `#f6f8fa` | 8px | 3.39:1 |
| `.metric-detail` | `#67818a` / `#ffffff` | 9px | 4.13:1 |

These are normal-sized text and fall below the 4.5:1 AA threshold described in [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Labels and supporting metrics become harder to read for users with low vision.

Recommendation: darken the affected text colors while preserving the palette, then check every rendered background and responsive state. Increasing font size can improve readability, but does not automatically remove the contrast requirement.

### 5. Low: starter pages contain broken ARIA references

Locations: [shared starter layout](../Views/Shared/_Layout.cshtml), lines 14–18; [Home/Index](../Views/Home/Index.cshtml), lines 6–7.

The navigation toggle references `navbarSupportedContent`, but the collapsed navigation has no corresponding ID. The home-page section references `aspnetTitle`, while its heading uses `id="title"`. Browser checks confirmed both missing references on `/`; the navigation reference is also missing on About and Contact.

Recommendation: give the controlled navigation its matching ID and align the section's `aria-labelledby` with its actual heading. Check all ARIA ID references across the retained starter pages.

## Verification Results

| Check | Result |
| --- | --- |
| Debug and Release MSBuild, `/p:MvcBuildViews=true` | Passed |
| `node --check Scripts/split-syllabus.js` | Passed |
| `tests/soe-coverage.tests.ps1` against local SQL Express temporary fixtures | Passed |
| Project-referenced file existence | No missing items found |
| `git diff --check` | Passed; Git emitted line-ending normalization notices |
| Dashboard desktop/mobile browser smoke checks | Passed apart from findings above; no JavaScript page errors |
| Direct SOE endpoint requests | Returned HTML 500, demonstrating findings 1 and 2 |

Browser checks exercised 24 district rows, filters/reset, January 2027 selection, sorting, district/block drilldown, report search, sample CSV export, empty-result export disabling, mobile sidebar/Escape, and starter-page routes. At 768px and 390px widths, no page-level horizontal overflow was observed. No SOE AJAX request occurred, as expected in dummy mode.

The SQL harness verified independent target/achievement aggregates, arithmetic averages with unequal denominators, active/month/cohort filters, optional filters, zero denominators, zero completions, January calendar year, empty scopes, and exactly two returned columns. It used temporary fixtures, not the application database.

## SQL, Security, and Integration Notes

The procedure correctly avoids joining target rows to school summaries, which would duplicate values. It excludes nonpositive monthly denominators, includes zero completion where the denominator is positive, and returns null aggregates for empty scopes. District filters affect achievement only because the target table has no district column; this is documented behavior.

Typed SQL parameters and `using` blocks are appropriate. Dynamic dashboard values use DOM text operations, and CSV export mitigates common formula prefixes. No SQL-injection path was identified in the reviewed action.

The SOE GET action has no repository-level authorization or geographic access checks. Before exposing real school reporting, decide whether the data is public; if it is restricted, enforce authentication and authorized scope on the server. This is a conditional deployment requirement, not a demonstrated private-data leak in the current dummy environment. Verify deployed configuration: the release transform removes `debug`, but a successful Release build alone does not prove that transform is applied during deployment.

Installed jQuery 3.7.0 is outside the affected range of the [checked jQuery advisory](https://github.com/jquery/jquery/security/advisories/GHSA-jpcq-cgw6-v4j6). jQuery Validation 1.19.5 is the patched version in the [checked validation advisory](https://github.com/jquery-validation/jquery-validation/security/advisories/GHSA-ffmh-x56j-9rc3). These limited checks do not constitute a complete vulnerability scan of all NuGet dependencies or bundled assets.

Live-schema compatibility, class-to-BatchId mappings, subject/district names, summary-row uniqueness, summary refresh timing, permissions, and production query plans remain unverified. Assess indexes and query plans with representative data before making performance claims or changes.

## Recommended Follow-up

Address API validation and predictable error responses before restoring live calls. Correct focus restoration and text contrast, then repair starter-page ARIA references. Preserve the current requested dummy mode until live loading is explicitly requested.

Add repeatable controller and browser regression checks for the findings; the repository already has useful SQL tests, but lacks committed automated coverage for these API and browser scenarios. Update dashboard wording that still claims live SOE data while dummy mode is active, especially the view's data-basis note and layout footer. The original protected `AGENTS.md` was left unchanged.

This review changed no application code, deployed no SQL, updated no work items, and created no commit or push. Existing local edits were preserved.
