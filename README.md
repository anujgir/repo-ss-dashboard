# repo-ss-dashboard

Starting repository for a dashboard project. The repository currently contains contributor documentation and six Codex agent definitions; application development has not started.

## Project Status

The application framework, features, and deployment setup have not been defined yet. There is currently no runnable application, dependency manifest, or automated test suite.

## Getting Started

Install Git, then clone the repository:

```sh
git clone https://github.com/anujgir/repo-ss-dashboard.git
cd repo-ss-dashboard
```

Read [AGENTS.md](AGENTS.md) for contribution guidelines. Installation, development, build, and test commands will be documented here when the application stack is added.

## Repository Structure

```text
repo-ss-dashboard/
├── .codex/agents/ # C#, testing, SQL Server, PM, code review, and security agents
├── AGENTS.md   # Contributor guidelines
└── README.md   # Project overview and setup information
```

## Development Agents

Six project-scoped Codex roles support C# development, testing, SQL Server database management and query optimization, project management, code review, and security review. See the [agent guide](.codex/agents/README.md) for responsibilities, usage examples, and coordination rules.

## Contributing

- Follow the conventions in [AGENTS.md](AGENTS.md).
- Keep each commit focused and use a concise, imperative commit message.
- Describe changes and validation in pull requests; include screenshots for visual changes.
- Update this README when adding application code, tooling, or setup requirements.

Before submitting changes, check for whitespace errors:

```sh
git diff --check
```

## Configuration

No environment variables or external services are required at this stage. When configuration is introduced, document the required settings and provide examples with placeholder values. Keep credentials and local environment files out of version control.
