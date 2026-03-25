# Changelog

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
