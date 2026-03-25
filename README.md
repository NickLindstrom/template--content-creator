# Onepager Site Template

A static one-page website template designed for GitHub Pages.

## Why this structure?

- `content/home.json` is the single source of truth for site content
- `scripts/build.js` injects content into `index.html` at build time
- Open Graph and SEO tags are generated server-side during build, which makes them reliable for social crawlers
- `main.css` and `index.js` stay generic and reusable across sites

## Files

- `content/home.json` - editable site content
- `src/template.html` - HTML template with placeholders
- `scripts/build.js` - generates `index.html` from JSON content
- `main.css` - global styles
- `index.js` - lightweight interactions
- `assets/og-default.svg` - fallback Open Graph image

## Usage

```bash
npm install
npm run build
```

Commit the generated files to GitHub Pages.

## Open Graph notes

Open Graph tags are generated into the final `index.html` during build. This is important because social media scrapers often do not execute client-side JavaScript. Set these fields in `content/home.json`:

- `seo.title`
- `seo.description`
- `seo.canonicalUrl`
- `seo.ogImage`

If `seo.ogImage` is empty, the template falls back to `/assets/og-default.svg`.
