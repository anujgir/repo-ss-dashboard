# Repository Agents

These six project-scoped Codex agent definitions support dashboard development. They define reusable roles; creating the files does not start background workers, scaffold an application, or connect to SQL Server.

All six roles read the [current codebase guide](../../docs/current-codebase.md). Their instructions are tailored to the existing ASP.NET MVC 5/.NET Framework 4.7.2 application, its actual paths, NuGet/MSBuild workflow, and current gaps. This is repository instruction tuning, not model fine-tuning.

| Agent name | Responsibility |
| --- | --- |
| `csharp_developer` | C#/.NET implementation, APIs, services, and data access |
| `tester_developer` | Automated tests, defect reproduction, and acceptance checks |
| `sql_server_specialist` | Schema, migrations, database management, and query optimization |
| `pm` | Project management, scope, priorities, acceptance criteria, and coordination |
| `code_reviewer` | Independent correctness, maintainability, and regression review |
| `security_reviewer` | Security review, evidence, and remediation recommendations |

## Usage

Open a current Codex client in this repository. Project agent discovery and invocation follow the [official subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents). If an already-open session does not discover new roles, start a new session from the repository root.

Ask for a named agent and a specific task, for example:

```text
Delegate to pm to plan the first dashboard milestone with acceptance criteria.
Use csharp_developer to implement the approved dashboard API task.
Use tester_developer to add regression tests for the changed API behavior.
Use sql_server_specialist to analyze this query and propose a measured optimization.
Delegate this diff to code_reviewer and security_reviewer; collect both reports.
```

Supply the relevant requirements, review base, or query and sanitized execution-plan evidence. SQL Server tasks require a separately configured, authorized connection if execution is needed. The MVC application has no database integration or automated test suite yet.

## Coordination

Start with PM scope and acceptance criteria, then implementation and database work, testing, and independent reviews. Run only independent tasks concurrently; avoid simultaneous edits to the same files. The parent session controls concurrency and permissions. Models and reasoning effort are inherited because these definitions do not override them.

Reviewers are instructed to avoid edits by default; this is a behavior instruction, not a separate read-only sandbox. Every role must report validation honestly, protect secrets, and follow [AGENTS.md](../../AGENTS.md). Git commits and pushes require task authorization.
