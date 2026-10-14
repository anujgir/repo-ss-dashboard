# Repository Guidelines

## Project Structure & Module Organization

This repository is currently an empty starting point: no application code, tests, assets, or dependency manifests have been committed. Update this guide when the initial dashboard implementation establishes the stack.

When scaffolding the project, prefer `src/` for application code, `tests/` for automated tests, and `public/` or `assets/` for static resources. Group dashboard features by responsibility, such as components, data access, and views. Document the actual layout in `README.md`; these paths are recommendations, not existing directories.

## Build, Test, and Development Commands

No build, test, lint, or local development commands are configured yet. Do not assume commands such as `npm test` work.

The initial implementation should define reproducible install, development, build, lint, and test commands in its tool configuration and explain them in `README.md`. Commit the appropriate dependency lockfile. Run commands from the repository root.

Use `git status --short` to review pending changes and `git diff --check` to catch whitespace errors before submitting work.

## Coding Style & Naming Conventions

Follow the conventions of the chosen language and framework. Until automated formatting is configured, use two spaces for Markdown and configuration indentation, avoid trailing whitespace, and end text files with a newline. Preserve language-required indentation.

Use descriptive names that convey purpose. Match existing naming patterns once source files exist. Add a formatter and linter with the initial stack, and keep formatting changes separate from functional changes.

## Testing Guidelines

No testing framework or coverage threshold is established. Select a framework alongside the application stack and document how to run it. Use descriptive test names covering expected behavior, boundary cases, and failure handling. Add regression tests for bug fixes and avoid dependencies on live services or private credentials.

## Commit & Pull Request Guidelines

There is no commit history from which to infer conventions. Use concise, imperative commit subjects, such as `Add dashboard shell`, and keep commits focused.

Pull requests should explain the change, link relevant issues, and report validation performed. Include screenshots for visual changes and identify any setup steps or known limitations.

## Security & Configuration

Never commit credentials or local environment files. Provide placeholder configuration examples and document required settings when configuration is introduced.
