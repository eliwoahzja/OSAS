# SAAC OSAS Dashboard — Preview Run Doc

## Reproduce uncommitted artifacts

This is a static HTML/CSS/JS site with Tailwind CSS. The compiled `css/tailwind.css` is already committed. No env files are needed — the workspace and main checkout share the same path.

If `css/tailwind.css` is missing or stale, rebuild:
```
npm install
npm run build
```

## Run the dev server

```
npx serve . -p 3000
```

This serves the static files on port 3000. No build step required for the preview since `tailwind.css` is already compiled and committed.
