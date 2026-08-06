# Repository Guidelines

## Project Structure & Module Organization

The main package is an ES module–based Node.js CLI. `bin/odtu.js` defines the Commander entry point and registers commands. Put individual command implementations in `src/commands/<command>.js`; shared Moodle and Student Portal access belongs in `src/client.js` and `src/student-client.js`, while terminal presentation helpers live in `src/ui.js`. The optional `video/` workspace contains the Remotion promotional video: compositions and scenes are under `video/src/`, static audio is in `video/public/`, and rendered files go to the ignored `video/out/` directory. Agent-facing usage documentation is maintained in `skills/odtu-cli-guide/`.

## Build, Test, and Development Commands

- `npm install` installs CLI dependencies; Node.js 18 or newer is required.
- `npm link` exposes the local executable as `odtu` for manual development.
- `node bin/odtu.js --help` checks command registration without installing globally.
- `cd video && npm install` installs the separate Remotion workspace.
- `cd video && npm run studio` opens the interactive video preview.
- `cd video && npm run render` renders `video/out/odtu-promo-v2.mp4`.

There is currently no root build, lint, or automated test script. Do not document or depend on one until it is added to `package.json`.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: two-space indentation, single quotes, semicolons, named exports for reusable utilities, and default exports for command registration functions. Keep command filenames lowercase (`src/commands/announcements.js`) and classes in PascalCase (`ODTUClassClient`). Preserve explicit `.js` extensions in ESM imports. Remotion TypeScript uses strict mode, PascalCase component files, and the formatting already present in the surrounding file.

## Testing Guidelines

Until a test framework is introduced, smoke-test affected commands through `node bin/odtu.js <command>`. Always verify `--help`; for authenticated flows, test success, expired-session recovery, and readable errors. Never commit credentials or files from `~/.odtuclass/`. For video changes, preview the affected frames in Remotion Studio and render once before submission.

## Commit & Pull Request Guidelines

Recent history favors short, imperative summaries, sometimes with Conventional Commit prefixes (for example, `feat: Create a promotional video`). Keep each commit focused and describe the user-visible result. Pull requests should include a concise rationale, commands or flows tested, and linked issues when applicable. Add terminal output for CLI behavior changes and screenshots or a short preview for video/UI changes. Call out authentication, session-storage, or endpoint changes explicitly.
