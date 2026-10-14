# SOE Coverage Setup

The SOE card calls `GET /SplitSyllabus/SoeCoverage`. Its controller validates filters and calls `Services/SoeCoverageService.cs`, which executes `dbo.usp_GetSoeSyllabusCoverage` with typed SQL parameters. `Index()` continues to load the view. Other dashboard metrics remain sample data.

## Database Deployment

The procedure definition is [usp_GetSoeSyllabusCoverage.sql](usp_GetSoeSyllabusCoverage.sql). Open it in SSMS, select the correct syllabus database, verify schema names/types, and execute it there. The script uses `CREATE OR ALTER`, supported by [SQL Server 2016 SP1 and later](https://learn.microsoft.com/en-us/sql/t-sql/statements/create-procedure-transact-sql). It has not been deployed to the owner's database.

Verify that `year` and `month` are calendar numbers, `ACS_id` identifies one master topic, school codes uniquely identify consistent school profiles, and `Category_ClassMapping.ClassId` matches `tbl_jharkhand_acs.batchId`. Parameter types and lengths must match the actual schema for production performance. The current class selector uses numeric class values as batch IDs, and subject/district selectors send their displayed names; these values must match database identifiers/names before using filtered live results. Actual types, mappings, and the target basis were not supplied.

## Required Settings

Set these environment variables for the application process, then restart IIS Express or the IIS application pool:

| Environment variable | Required value |
| --- | --- |
| `SPLIT_SYLLABUS_SQL_CONNECTION_STRING` | Connection string for the actual syllabus database; keep credentials outside Git. |
| `SPLIT_SYLLABUS_SOE_STATE_SPECIFIC_TYPE` | Exact SOE value used by master topics, school profiles, and target records. |
| `SPLIT_SYLLABUS_COVERAGE_BASIS` | `Monthly`, `AnnualMonthly`, or `Cumulative`, matching the meaning of stored TargetPercentage. |

Alternatively, configure a local/deployment `connectionStrings` entry named `SplitSyllabus`, and set `SplitSyllabus.SoeStateSpecificType` and `SplitSyllabus.CoverageBasis` in `Web.config`. Environment values take precedence. The committed cohort/basis settings are deliberately empty; no SOE identifier, database, or percentage basis is guessed. Never commit real credentials.

The database identity needs EXECUTE access to the procedure, with access to its underlying objects determined by SQL Server ownership and permissions. The endpoint returns aggregate coverage only. Existing authentication is not implemented; configure server-side access control before exposing private production data.

## Calculation

The procedure reads `tbl_jharkhand_acs`, `School_Profile`, `Category_ClassMapping`, `AcademicYearCalendarTracking`, `LMs_DistrictMaster`, and `Tbl_SplitSyllabusTargetPercentage`. It uses source tracking rather than the reporting summary to avoid summary-refresh lag. It does not change any base-table records.

- Master topics must be active, not deleted, in the configured SOE cohort, and eligible for the school's category/class.
- A completed topic is a distinct `(SchoolCode, ACS_id)` pair with at least one tracking record having `IsCompleted = 1`. Multiple teachers or duplicate approvals do not multiply completion.
- Monthly achievement is approved selected-month school-topics divided by eligible selected-month school-topics, multiplied by 100.
- AnnualMonthly achievement is approved selected-month school-topics divided by all eligible academic-year school-topics, multiplied by 100. This supports targets expressed as that month's contribution to the annual syllabus.
- Cumulative achievement is approved school-topics scheduled through the selected month divided by all eligible academic-year school-topics, multiplied by 100. Future scheduled topics contribute only to the annual denominator.
- All three bases use the selected calendar month/year's configured target, weighted by the corresponding eligible topic denominator for each class/subject group. The configured target must use that same basis; the procedure cannot infer its semantics.
- January through March map to the following calendar year. Historical scope uses syllabus month, not a reconstruction of completion as of an ApprovalDate cutoff.
- Missing or out-of-range targets produce a null target with a missing-group count. Duplicate targets produce an explicit error. Zero eligible topics produce N/A, not an artificial zero percentage.

## Response and Dashboard States

Successful responses have `success: true` and `data` fields: `TargetPercentage`, `AchievedPercentage`, `CompletedTopics`, `EligibleTopics`, `MissingTargetGroups`, `CoverageBasis`, `CalendarYear`, and `SyllabusMonth`. Invalid filters return HTTP 400. Missing configuration, unavailable database/procedure, or duplicate targets return HTTP 503 with a safe message; connection strings and SQL error details are not returned.

The browser fetches coverage on load and when filters are applied. It clears old values during requests, ignores stale responses, and shows unavailable data as N/A without sample fallback. Excluding SOE through the cohort filter prevents the request entirely. Coverage labels switch to the configured monthly or cumulative basis.

## Verification

Run isolated stored-procedure fixture tests against a local SQL Server with Windows authentication:

```powershell
.\tests\soe-coverage.tests.ps1 -ServerInstance '.\SQLEXPRESS'
```

The harness reads the actual procedure source and substitutes connection-local temporary tables/procedure in `tempdb`; it creates no application database or permanent objects. Verified on local SQL Server 17: monthly/cumulative arithmetic, weighting, school-class eligibility, duplicate completions, inactive/deleted topics, January rollover, filters, zero topics, missing/invalid/duplicate targets, and invalid months.

Browser checks cover the real unconfigured endpoint and mocked success/error responses, filters, and missing targets. Live deployment and values remain unverified until the owner supplies the connection, SOE identifier, percentage basis, and actual schema mappings. This procedure is not a performance benchmark; inspect plans and data distribution before adding production indexes.
