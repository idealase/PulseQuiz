# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added
- GitHub Copilot SDK CLI detection, including bundled CLI discovery and executable permission handling.
- Input validation for AI endpoints (topics length and emptiness, model validation, confidence clamping).
- Clearer authentication and CLI-not-found error messages with actionable guidance.

### Changed
- More robust parsing for Copilot responses (code block extraction, JSON parse safeguards).
- Fact-check handling to validate and clamp confidence values.
- Debug logging to surface Copilot CLI resolution and parse failures.

### Fixed
- Copilot CLI lookup to work when the SDK is installed via pip.
- Uncaught JSON parsing errors that could crash AI endpoints.

### Notes
- AI features use the Copilot CLI subprocess flow and require `GITHUB_TOKEN`, `GH_TOKEN`, or `COPILOT_GITHUB_TOKEN` to be set.
