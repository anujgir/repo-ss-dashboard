# Split Syllabus Domain and Data Contract

Source: the repository owner's supplied schema and workflow, recorded 2026-10-14. Column types, constraints, indexes, identifier values, and some relationships have not been supplied. Do not infer them from names alone. The browser-readable [PRD](split-syllabus-prd.html) defines the staged delivery.

## Technology and Current Scope

Use the existing ASP.NET MVC 5 / .NET Framework 4.7.2 application, C#, Razor-generated normal HTML, local Bootstrap, custom CSS, and only necessary vanilla JavaScript. SQL Server is the eventual database. Do not introduce ASP.NET Core, React, Angular, a Node runtime, external chart services, or a database migration.

The original Step 1 delivered a view prototype with an `Index` action returning `View()`. `Views/SplitSyllabus/Index.cshtml` renders the dashboard using a dedicated layout. That first phase used browser-local sample data. The subsequent authorized SOE-only integration is described below; the remaining backend features still await instruction.

The owner has now authorized the SOE coverage portion of Step 2. `SoeCoverage` is an asynchronous MVC GET action backed by `SoeCoverageService` and `docs/usp_GetSoeSyllabusCoverage.sql`. The SOE card requests that endpoint and does not fall back to sample values. Other cards, charts, and participation metrics remain illustrative. Read [SOE coverage setup](soe-coverage-setup.md) for required configuration and supported monthly/cumulative calculations. Deployment and live data verification require the owner's actual connection and schema settings; approval writes and other backend metrics are not authorized by this step.

## Supplied Tables and Columns

### tbl_jharkhand_acs: master syllabus topics

`ACS_id`, `year`, `month`, `week`, `Academicyearid`, `ChapterName`, `Topic`, `batchId`, `batchName`, `subjectId`, `subjectName`, `CreatedOn`, `CreatedBy`, `IsActive`, `DeletedOn`, `DeletedBy`, `StateSpecificType`, `Due Date`, `TextbookId`, `LOs`, `RAIL Date`, `Identifier`.

One month may contain multiple topic rows for a class and subject. Identify topics by `ACS_id`, not the topic text or month. Treat `batchId` as the class identifier only after verifying the Category_ClassMapping.ClassId relationship. Confirm how academic-year IDs and calendar year/month values are stored.

### AcademicYearCalendarTracking: teacher requests and completion

`TrackingId`, `AC_ID`, `userid`, `IsCompleted`, `createdon`, `SchoolId`, `StatusType`, `StatusDate`, `ApprovalDate`, `DelayDays`, `UserRemarks`, `ApproverRemarks`, `ApprovalStatus`, `ModifiedOn`, `ModifiedBy`, `SchoolCode`.

The explicit relationship is `tbl_jharkhand_acs.ACS_id = AcademicYearCalendarTracking.AC_ID`. A teacher request inserts tracking data, including the school code and teacher ID. The principal approves it, then `IsCompleted` becomes `1`. Only `IsCompleted = 1` means a topic is completed for that school, class, and subject. A request without completion still counts as participation. `ApprovalStatus` and `StatusType` codes were not supplied; do not invent mappings.

Count completed topics once per `(SchoolCode, AC_ID)` even if there are repeated requests or different teachers for the same topic. Decide how reopening, cancellation, and conflicting approvals behave before implementing live queries.

### School_Profile: school and geography

`SchoolName`, `SchoolCode`, `StateSpecificType`, `SchoolCategoryId`, `LMS_DistrictId`, `LMS_BlockId`.

Join tracking to schools through school code after confirming its uniqueness and formatting. Determine whether SchoolId has a separate authoritative mapping. Join `LMS_DistrictId` to the district master and `LMS_BlockId` to the block master. Do not silently coerce codes to numbers or discard leading zeroes.

### Category_ClassMapping: classes eligible for a school category

`CategoryId`, `ClassId`. Link `School_Profile.SchoolCategoryId = Category_ClassMapping.CategoryId`. Confirm `ClassId = tbl_jharkhand_acs.batchId`. Only eligible school-class pairs belong in school-topic denominators. Categories 1, 2, and 3 are example values, not supplied category names.

### Geography masters

- `LMs_DistrictMaster`: `DistrictId`, `DistrictName`.
- `LMS_BLockMaster`: `BlockId`, `BlockName`.

Use the owner's exact identifiers until verified against SQL Server metadata. The supplied block columns have no DistrictId; derive a block's district through School_Profile, not an assumed block-master foreign key. Include eligible districts and blocks with zero requests through an appropriate master/eligibility base.

### UserProfile: teacher population

`UserId`, `UserName`, `SystemROle`. Teachers have `SystemROle = 102`. Link tracking `userid` to `UserId` after validating types. No teacher-school, class, subject assignment, account-active, or employment mapping was supplied. These missing mappings prevent an accurate geographically filtered count of teachers with no requests; do not manufacture that join.

### SplitSyllabusCompletedDetails: reporting summary

`DistrictId`, `DistrictName`, `BlockId`, `BlockName`, `BatchId`, `BatchName`, `SubjectId`, `SubjectName`, `School Code`, `UpdatedOn`, `IsActive`, `Year`, `Month`, `StateSpecificType`, `YearTopics`, `MonthTopics`, `CompletedTopics`, `SchoolType`, `Management`, `SchoolCategory`, `SchoolName`.

Expected reporting grain, to verify: school, class, subject, calendar year/month, and state-specific type. `YearTopics` is the total class/subject topic count for the academic year; `MonthTopics` is that month's topic count; `CompletedTopics` is that month's completed topic count. `YearTopics` repeats across monthly rows and must not be summed twelve times for annual reporting. Confirm summary uniqueness, refresh method, freshness, completion deduplication, and consistency with tracking. Summary topic counts describe syllabus-month completion, not necessarily approvals created during the selected month.

### Tbl_SplitSyllabusTargetPercentage: configured targets

`BatchId`, `BatchName`, `SubjectId`, `SubjectName`, `Month`, `TargetPercentage`, `Year`, `StateSpecificType`, `MonthTopics`, `YearTopics`.

Targets are class/subject/month/year/cohort-specific. Confirm uniqueness and whether TargetPercentage is monthly completion, monthly contribution to annual syllabus, or cumulative academic-year progress before comparing it with achievement. Join at its full key before aggregation; do not multiply reporting rows by duplicate targets or count nonexistent targets as zero.

## Metrics and Grain Rules

Academic year: 2026-04-01 inclusive to 2027-04-01 exclusive, displayed as 2026-27. January through March belong to calendar year 2027. Filter master topics by the verified academic year and syllabus month; distinguish that from tracking.createdon and ApprovalDate.

| Dashboard metric | Live-data definition or requirement |
| --- | --- |
| SOE target and achieved percentages | Scope schools/topics to the confirmed SOE StateSpecificType. Use configured target and comparable achieved basis. |
| Other-than-SOE target and achieved | Scope to confirmed non-SOE values; decide treatment of NULL/unmapped values. |
| Teachers started | Distinct eligible teacher UserId with at least one qualifying tracking request, regardless of approval, with role 102. |
| Schools started | Distinct eligible SchoolCode with at least one qualifying request. |
| Teachers not started | Eligible teacher population minus distinct started teachers; school/geographic scope requires missing assignment data. |
| Districts started | Distinct school district IDs with at least one qualifying request. |
| Blocks started | Distinct school block IDs with at least one qualifying request; verify whether block IDs are globally unique. |
| Approved topics | Distinct eligible school-topic pairs with IsCompleted = 1. |
| Pending approval / rejected requests | Require verified ApprovalStatus codes and latest-request semantics; do not derive both from IsCompleted = 0 alone. |
| Delayed items | Define due-date basis and approval status before using DelayDays or [Due Date]. |
| Summary freshness | Latest verified UpdatedOn plus explicit refresh-lag handling. |

Use weighted aggregation, never a simple average of district/school/class percentages. For a monthly completion basis, proposed achieved = `100 × SUM(CompletedTopics) / SUM(MonthTopics)` across eligible school-class-subject summaries, with zero denominator shown as N/A. Proposed weighted target = `SUM(TargetPercentage × eligible MonthTopics) / SUM(eligible MonthTopics)` after validated target joins. Prototype sample figures use this monthly basis only for design consistency; the owner must confirm the production basis.

If target basis is cumulative annual progress instead, calculate both values through the selected month and deduplicate annual topic denominators per school/class/subject/cohort. Do not mix monthly numerators with cumulative targets. Use [Due Date], [RAIL Date], and [School Code] with bracketed SQL identifiers. No SQL is executed in Step 1.

## Open Decisions Before Step 2

Confirm SOE identifier and non-SOE/null handling; target/achievement basis; all column types and keys; academic-year ID; school-class/batch mapping; teacher-school assignments and eligible teacher population; status codes; duplicate requests and reopening behavior; summary grain and refresh; block district mapping and uniqueness; data access and authentication requirements. Also distinguish total eligible geography from geography containing requests.

## Agent Responsibilities

- C# developer: preserve MVC 5 compatibility and the view-only controller boundary; add query/services logic only in Step 2.
- Tester: verify all cards, filter consistency, all-district rendering, accessible drilldown, mobile sidebar, academic-year rollover, zero denominators, duplicate completion, and eventual role-102 population rules.
- SQL specialist: validate supplied schema metadata and full join grains, avoid summary fan-out, plan measured indexes and read-only reporting after authorization, and resolve missing mappings before live metrics.
- PM: keep design delivery separate from SQL implementation and track open decisions.
- Code reviewer: inspect framework compatibility, counting semantics, weighted percentages, full-key joins, assets, and the controller boundary.
- Security reviewer: scope eventual geography access server-side, parameterize queries, protect connection strings and teacher identifiers, and review approval mutations separately.
