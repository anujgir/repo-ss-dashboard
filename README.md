# repo-ss-dashboard

Dashboard project starting from a classic ASP.NET MVC 5 application on .NET Framework 4.7.2, with six repository-specific Codex agents.

## Project Status

The application contains the standard Home, About, and Contact pages and a Split Syllabus dashboard design prototype at `/SplitSyllabus/Index`. The prototype uses illustrative data, normal HTML, local Bootstrap, CSS, and necessary vanilla JavaScript. Live database integration, authentication, automated test projects, and CI have not been implemented yet. Dependencies include MVC 5.2.9, Razor 3.2.9, Bootstrap 5.2.3, and jQuery 3.7.0, managed through `packages.config`.

## Split Syllabus Dashboard

Open `/SplitSyllabus/Index` after starting IIS Express, or use the Split Syllabus link on the Home page. The view includes a responsive sidebar, SOE/non-SOE target and achieved cards, teacher/school/geography participation, district and block charts, an approval summary, monthly trend, filters, and sample CSV export. Selecting a district name opens its block chart below.

Read the [browser-readable PRD](docs/split-syllabus-prd.html) and [supplied SQL Server schema contract](docs/split-syllabus-domain.md). The new controller only returns the view; SQL queries and controller data logic are reserved for the owner's next implementation step. Every displayed count and percentage is sample data.

## Getting Started

Use Windows with Visual Studio 2022, the ASP.NET and web development workload, and the .NET Framework 4.7.2 targeting pack. Clone the repository:

```sh
git clone https://github.com/anujgir/repo-ss-dashboard.git
cd repo-ss-dashboard
```

Open `repo-syllabusmis-dashbaord.sln` in Visual Studio, restore NuGet packages, and launch with IIS Express. The project specifies `https://localhost:44343/`; use the URL shown by your local launch settings.

With NuGet CLI installed, run these commands from the repository root in Visual Studio Developer PowerShell:

```powershell
nuget restore .\repo-syllabusmis-dashbaord.sln
msbuild .\repo-syllabusmis-dashbaord.sln /t:Build /p:Configuration=Debug /p:MvcBuildViews=true
msbuild .\repo-syllabusmis-dashbaord.sln /t:Build /p:Configuration=Release /p:MvcBuildViews=true
```

`MvcBuildViews=true` enables Razor compilation. This classic ASP.NET application has no configured `dotnet run` or npm workflow. Restored packages belong in root `packages/` and are ignored by Git, along with build output and Visual Studio user settings.

## Repository Structure

```text
repo-ss-dashboard/
├── .codex/agents/                 # Six specialist agent definitions
├── docs/current-codebase.md       # Architecture and agent context
├── App_Start/                    # Routes, filters, and bundles
├── Controllers/                  # HomeController
├── Views/                        # Razor pages and shared layout
├── Content/                      # CSS assets
├── Scripts/                      # JavaScript assets
├── Properties/                   # Assembly metadata
├── Global.asax                   # Application startup entry point
├── repo-syllabusmis-dashbaord.sln
├── repo-syllabusmis-dashbaord.csproj
├── packages.config               # Pinned NuGet dependencies
├── Web.config                    # ASP.NET configuration
├── AGENTS.md                     # Original contributor guidelines
└── README.md
```

The solution and application share the repository root. Preserve the existing `dashbaord` spelling in filenames and the `repo_syllabusmis_dashbaord` namespace unless a coordinated rename is requested.

## Development Agents

Six project-scoped Codex roles support C# development, testing, SQL Server database management and query optimization, project management, code review, and security review. Each role reads the [current codebase guide](docs/current-codebase.md). See the [agent guide](.codex/agents/README.md) for responsibilities, usage examples, and coordination rules.

## Validation

No automated test suite or coverage target exists yet. Build the solution and smoke-check `/`, `/Home/About`, and `/Home/Contact`, navigation, responsive layout, and browser console/network errors. Build success does not establish browser behavior or test coverage.

## Contributing

- Follow the conventions in [AGENTS.md](AGENTS.md).
- Keep each commit focused and use a concise, imperative commit message.
- Describe changes and validation in pull requests; include screenshots for visual changes.
- Update this README when adding application code, tooling, or setup requirements.

The original `AGENTS.md` predates the application import and remains preserved. Its description of an empty repository is historical; current paths, commands, and architecture are documented here and in the codebase guide. Register new source and content files explicitly in the non-SDK `.csproj`.

Before submitting changes, check for whitespace errors:

```sh
git diff --check
```

## Configuration

There is no active database connection or required external service. Commented connection examples in configuration transforms do not configure a database. Keep credentials, local database files, and personal publish settings out of Git. Release publishing uses `Web.Release.config` to remove compilation debugging; verify deployed configuration separately from a successful Release build.
