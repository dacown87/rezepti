# Changelog

## [1.0.48] – 2026-03-31

- add Logo.png to public/ and frontend/public/

## [1.0.47] – 2026-03-31

- revert logo from SVG back to Logo.png

## [1.0.46] – 2026-03-31

- Logo, Chefkoch image fixes, PDF redesign, QR scanner fixes

## [1.0.45] – 2026-03-29

- copy vite.config.ts for Docker build

## [1.0.44] – 2026-03-29

- add rollupOptions input to vite config for Docker

## [1.0.43] – 2026-03-29

- resolve conflict
- run vite build from frontend directory

## [1.0.42] – 2026-03-29

- remove paths-ignore from docker workflow
- simplify vite config, remove test section to fix Docker build

## [1.0.40] – 2026-03-29

- build frontend from root with npm run build:react

## [1.0.39] – 2026-03-29

- run frontend build from frontend directory

## [1.0.38] – 2026-03-29

- use correct npm script 'build' instead of 'build:react'

## [1.0.37] – 2026-03-29

- use npm install instead of npm ci in frontend-builder (no lock file)

## [1.0.36] – 2026-03-29

- build frontend in Docker to fix missing JS bundles

## [1.0.35] – 2026-03-29



## [1.0.34] – 2026-03-29



## [1.0.33] – 2026-03-29

- docker-publish workflow auch bei direct push

## [1.0.32] – 2026-03-29

- verbesserte QR-scanner fehlerbehandlung, footer layout, docker build trigger

## [1.0.31] – 2026-03-29

- QR-scanner, PDF-export modal, changelog entfernt

## [1.0.30] – 2026-03-29



## [1.0.29] – 2026-03-29

- integrate QR scanner into ExtractionPage and PlannerPage

## [1.0.28] – 2026-03-28



## [1.0.27] – 2026-03-28

- Phase 13 Pinterest Import - Proxy-Fetcher, API Integration, Vision-OCR
- Phase 12 code review fixes + classifier tests
- Phase 12 TikTok - Video OCR integration + unit tests
- Phase 11 Instagram - Complete (Carousel, OCR, Fallback)
- Phase 11 Instagram Verbesserungen (Kern)
- Phase 10 - Zutaten-basierte Rezeptvorschläge
- Phase 9 - Chefkoch Import-Verbesserung (40% → 100%)

## [1.0.26] – 2026-03-28



## [1.0.25] – 2026-03-27

- update in-app roadmap after Phase 1-5 delivery

## [1.0.24] – 2026-03-27



## [1.0.23] – 2026-03-27

- Phase 5 — meal planner + offline QR code sharing
- Phase 4 — ingredient search + PDF export
- Phase 3c — ingredient dictionary + shopping list

## [1.0.22] – 2026-03-27

- Phase 3c — ingredient dictionary + shopping list with multi-recipe aggregation
- Phase 4 — PDF export with QR code, ingredient-based recipe search
- Phase 5 — meal planner (7-day view), offline QR code sharing with recipe JSON
- fix route ordering for shopping list delete endpoints
- fix Drizzle camelCase→snake_case serializer
- fix race condition in shopping list useEffect
- fix checked shopping items now visible with strikethrough
- fix QR decode array validation
- fix PDF export page overflow in notes section

## [1.0.21] – 2026-03-26

- copy .npmrc into all Dockerfile stages before npm ci

## [1.0.20] – 2026-03-26

- add .npmrc with legacy-peer-deps for vite-plugin-pwa peer dep conflict

## [1.0.19] – 2026-03-26

- Phase 3b — photo import (camera/gallery → AI extraction)
- show star rating in recipe detail header and list/grid views
- Phase 3a — recipe rating (1–5 stars) + personal notes
- cook mode responsive layout — sidebar on desktop, improved drawer on mobile
- Phase 2 — PWA setup + Fullscreen Cook Mode
- Phase 1 — polished core fixes

## [1.0.18] – 2026-03-25

- remove performance-test references and add missing newline

## [1.0.16] – 2026-03-25

- increase serving size stepper buttons from w-4 to w-7

## [1.0.15] – 2026-03-25

- correct created_at storage, date display and footer timezone

## [1.0.14] – 2026-03-25

- correct recipe date display and changelog version numbers

## [1.0.13] – 2026-03-25

- trigger Docker build via workflow_run after changelog completes

## [1.0.12] – 2026-03-25



## [1.0.11] – 2026-03-25

- correct recipe date display (Unix seconds → milliseconds)

## [1.0.10] – 2026-03-25

- add error details panel with copy button on extraction failure
- filter changelog to only user-relevant commits, strip prefixes
- copy frontend/public/changelog.json into Docker production image
- read and write changelog.json from same file (frontend/public/)
- use file mtime as lastUpdated in changelog.json response
- serve changelog.json from frontend/public/ (source of truth)
- serve /changelog.json as static route
- add lastUpdated field to changelog.json and update script
- restore lastUpdated footer and dynamic changelog in Layout
- convert update-changelog.js to ES module syntax

## [1.0.9] – 2026-03-25

- filter changelog to only user-relevant commits, strip prefixes
- copy frontend/public/changelog.json into Docker production image
- read and write changelog.json from same file (frontend/public/)
- use file mtime as lastUpdated in changelog.json response
- serve changelog.json from frontend/public/ (source of truth)
- serve /changelog.json as static route
- add lastUpdated field to changelog.json and update script
- restore lastUpdated footer and dynamic changelog in Layout
- convert update-changelog.js to ES module syntax
- mobile UI improvements + auto-changelog workflow

## [1.0.8] – 2026-03-25

- fix: copy frontend/public/changelog.json into Docker production image
- fix: read and write changelog.json from same file (frontend/public/)
- feat: use file mtime as lastUpdated in changelog.json response
- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow

## [1.0.7] – 2026-03-25

- fix: read and write changelog.json from same file (frontend/public/)
- feat: use file mtime as lastUpdated in changelog.json response
- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README

## [1.0.6] – 2026-03-25

- feat: use file mtime as lastUpdated in changelog.json response
- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README

## [1.0.5] – 2026-03-25

- fix: serve changelog.json from frontend/public/ (source of truth)
- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons

## [1.0.4] – 2026-03-25

- fix: serve /changelog.json as static route
- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json

## [1.0.3] – 2026-03-25

- fix: add lastUpdated field to changelog.json and update script
- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json
- chore: complete dependency updates

## [1.0.2] – 2026-03-25

- fix: restore lastUpdated footer and dynamic changelog in Layout
- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json
- chore: complete dependency updates
- chore: update dependencies to latest versions

## [1.0.1] – 2026-03-25

- fix: convert update-changelog.js to ES module syntax
- chore: npm audit fix – flatted Schwachstelle behoben
- feat: mobile UI improvements + auto-changelog workflow
- docs: clean up and improve README
- docs: add fork comparison table to README
- docs: update roadmap and fix lucide-react icons
- chore: update package-lock.json
- chore: complete dependency updates
- chore: update dependencies to latest versions
- fix: include public/index.html in Docker build

## [1.0.0] – 2026-03-25

- Initial release
