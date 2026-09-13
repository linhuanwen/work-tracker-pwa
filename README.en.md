# Work Journal

> Daily task management + auto-generated weekly / monthly / yearly work summaries.
> **Log once, report anytime.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2B-0078D4.svg)](#requirements)

[中文](README.md) · English

## What it is

A small, local-first PWA for people whose work needs to be reported on a cycle: log
tasks and their measurable output as you go, and get your weekly, monthly, and yearly
summaries generated from that data instead of reconstructed from memory.

It is not a generic to-do app. The unit of interest is not "was it done" but
"what did it produce" — quantities (15 reviews, 138 records filed), sub-task progress
on long-running projects, and cycle-over-cycle progress (40% → 60%).

## Features

- **Daily tasks** — three priority levels, an urgent zone, projects with sub-tasks and
  progress bars, measurable-output tags, delegated-item flags, cross-year hibernation.
- **Weekly summary** — four fixed sections (completed / project progress / next week /
  blockers), generated from task data, copyable as plain text or exportable to Word.
- **Monthly & yearly reports** — quantity roll-up tables, month-over-month project
  progress, six work dimensions for the annual report, plus a monthly trend table and a
  full-year quantity table.
- **Optional AI polish** — a standalone Python CLI that rewrites summary wording into
  formal written Chinese via any OpenAI-compatible endpoint (DeepSeek, Qwen, …).
  Off by default; never required.
- **One file of data** — everything lives in a single `data.json` you can copy, sync via
  any cloud drive, or keep entirely offline. No account, no server, no telemetry.

## Quick start

```bash
git clone https://github.com/linhuanwen/work-tracker-pwa.git
cd work-tracker-pwa

npm install
npm run build

# Serve the PWA locally (headless HTTP server, full API)
python run.py --headless
# then open http://127.0.0.1:5173 and use your browser's "Install" action
```

Windows users who prefer zero setup can use the prebuilt `release/工作清单.exe`
(requires WebView2 Runtime, bundled with Windows 11).

**Try it with sample data:** [`demo/data.json`](demo/data.json) contains fictional
projects, tasks, and archives — pick the `demo/` folder in the app and you'll see a
fully populated UI. Regenerate it relative to today's date with
`python scripts/make_demo_data.py`.

## Architecture

- **Frontend**: React 18 + Vite + TypeScript, PWA via `vite-plugin-pwa`, data read and
  written through the File System Access API.
- **Desktop launcher**: Python + pywebview (WebView2) — frameless window, tray icon,
  packable into a single `.exe` with PyInstaller.
- **AI polish**: standalone Python script (`scripts/polish.py`).
- **Zero backend**: no server, no database, no deployment.

## Development

```bash
npm run dev           # dev server with HMR
npm test              # vitest
npm run lint          # eslint
npm run format:check  # prettier
python scripts/check_all.py   # full gate: typecheck + lint + format + tests + ruff + pytest
```

## Requirements

| Requirement        | Notes                                                  |
| ------------------ | ------------------------------------------------------ |
| OS                 | Windows 10+ / Windows 11                               |
| Browser (PWA mode) | Recent Chrome or Edge                                  |
| WebView2 Runtime   | Bundled on Windows 11; may need install on Windows 10  |
| Python (optional)  | 3.11+, only for running from source or using AI polish |

## Documentation

The design docs and user guide are written in Chinese:

- [Installation](docs/INSTALL.md)
- [User guide](docs/USER-GUIDE.md)
- [Design specs](docs/specs/)

## License

[MIT](LICENSE)
