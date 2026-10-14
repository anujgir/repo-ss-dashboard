# Current Codebase Guide

Application snapshot inspected on 2026-10-14. Every repository agent should read this guide and verify the relevant source because the snapshot will age. The original root `AGENTS.md` predates the application import and remains preserved; its description of an empty repository is historical.

## Stack and Paths

- Solution: `repo-syllabusmis-dashbaord.sln` at the repository root.
- Application root: the repository root; `Controllers/`, `Views/`, and `App_Start/` are directly beneath it.
- Project: `repo-syllabusmis-dashbaord.csproj` at the repository root, a classic, non-SDK ASP.NET web application targeting .NET Framework 4.7.2.
- Framework: ASP.NET MVC 5.2.9 (`System.Web.Mvc`) and Razor/WebPages 3.2.9, hosted through IIS Express during local development.
- Namespace: `repo_syllabusmis_dashbaord`. Preserve the existing spelling in paths and namespaces unless a coordinated rename is requested.
- Dependencies: root `packages.config`; restored packages belong in root `packages/`, as required by project hint paths and imports. Bootstrap 5.2.3, jQuery 3.7.0, jQuery Validation 1.19.5, Modernizr 2.8.3, Newtonsoft.Json 13.0.3, and CodeDom compiler provider 2.0.1 are pinned there.
- No SDK-style project, ASP.NET Core middleware, npm workflow, formatter, or linter is configured.

## Request and Rendering Flow

Paths below are relative to the application root. `Global.asax.cs` registers areas, filters, routes, and bundles during `Application_Start`.

`App_Start/RouteConfig.cs` maps `{controller}/{action}/{id}` to `Home/Index` by default. `Controllers/HomeController.cs` has three parameterless actions returning views: `Index`, `About`, and `Contact`. About and Contact populate `ViewBag.Message` with template text. There are no POST actions or implemented dashboard business features.

`Views/Home/*.cshtml` contains starter pages. `Views/_ViewStart.cshtml` selects `Views/Shared/_Layout.cshtml`, which supplies navigation, footer, and bundle rendering. `App_Start/BundleConfig.cs` defines jQuery, validation, Modernizr, Bootstrap, and CSS bundles. `Content/Site.css` contains custom styles; Bootstrap and jQuery assets are vendor files managed through NuGet.

## Split Syllabus Design Prototype

`/SplitSyllabus/Index` is served by `Controllers/SplitSyllabusController.cs`; its Index action returns the view, and its SoeCoverage action fetches SOE data. `Views/SplitSyllabus/Index.cshtml` uses `Views/Shared/_SplitSyllabusLayout.cshtml`, local Bootstrap, `Content/split-syllabus.css`, and `Scripts/split-syllabus.js`. The dashboard has cohort target/achieved cards, participation counts, all-district comparison, district-to-block drilldown, filters, an approval snapshot, monthly trend, and sample CSV export.

Other than SOE coverage, figures are illustrative browser fixtures. Read [the product PRD](split-syllabus-prd.html) and [the owner's full schema contract](split-syllabus-domain.md) before feature work. The exact SOE value, percentage basis, teacher-school mapping, and actual schema types still require confirmation. Approval mutations and the remaining live metrics await separate instruction.

The owner has revised SOE coverage to use reporting summaries. SplitSyllabusController.SoeCoverage directly executes dbo.usp_GetSoeSyllabusCoverage using SqlConnection, SqlCommand, and SqlDataAdapter.Fill against the connection string named cs. The procedure returns only TargetPercentage and AchievedPercentage: arithmetic averages from Tbl_SplitSyllabusTargetPercentage and active monthly SplitSyllabusCompletedDetails rows. The service and DTO were removed. A dummy cs connection string is committed for manual replacement. See [setup and validation](soe-coverage-setup.md). Other metrics remain sample data; isolated SQL tests are in tests/soe-coverage.tests.ps1. No approval writes are added.

## Data, Tests, and Security Baseline

- `Models/` and `App_Data/` are declared as folders but contain no source implementation or database files.
- The owner has supplied the SQL Server domain schema, recorded in `docs/split-syllabus-domain.md`. The SOE summary-based procedure and direct ADO.NET controller call are implemented, with a dummy cs connection string for manual replacement. No ORM or database migrations are introduced. Commented transform examples in `Web.Debug.config` and `Web.Release.config` are not configured databases.
- No .NET test project, coverage requirement, or CI pipeline exists. `tests/soe-coverage.tests.ps1` exercises the stored procedure with isolated SQL fixtures. Build success does not establish live database or browser correctness.
- No application authentication or authorization rules are implemented. Current pages display public template content; establish protection requirements before adding sensitive features.
- `FilterConfig.cs` registers `HandleErrorAttribute`. `Web.config` enables compilation debugging; the Release publish transform removes that attribute. A plain Release build alone does not demonstrate safe deployment configuration.
- `Views/Web.config` configures Razor and blocks direct view requests. Preserve those protections.

## Development and Verification

Use Windows and Visual Studio 2022 with the ASP.NET and web development workload and .NET Framework 4.7.2 targeting pack. Run these commands from the repository root in Visual Studio Developer PowerShell, with NuGet CLI installed:

```powershell
nuget restore .\repo-syllabusmis-dashbaord.sln
msbuild .\repo-syllabusmis-dashbaord.sln /t:Build /p:Configuration=Debug /p:MvcBuildViews=true
msbuild .\repo-syllabusmis-dashbaord.sln /t:Build /p:Configuration=Release /p:MvcBuildViews=true
git diff --check
```

The view-build option enables Razor compilation, disabled by default in the project. Open the solution in Visual Studio and start IIS Express to check `/`, `/Home/About`, and `/Home/Contact`, navigation, responsive layout, and browser console/network errors. The project specifies `https://localhost:44343/`; use the actual launch URL if local settings differ. No automated test command is configured yet.

## Editing and Handoffs

Follow four-space C# indentation and existing MVC conventions: `NameController`, `ActionResult`, and matching Razor views. The project explicitly lists compile and content items; register new files in the `.csproj`. Keep package versions, hint paths, binding redirects, and bundled vendor assets consistent when upgrading dependencies. Do not introduce modern language features or ASP.NET Core APIs without checking compatibility.

PM defines requirements; the C# developer owns application changes; the tester owns test work; the SQL Server specialist owns database work when introduced. Reviewers return evidence and practical fixes. Coordinate shared-file edits, record actual validation, and update this guide when architecture changes.
