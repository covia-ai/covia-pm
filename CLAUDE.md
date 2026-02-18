# Covia PM - Development Guide

## Overview

Covia PM is the frontend application for federated AI project management, demonstrating coordination across Jira, GitHub, and Slack via the Covia Grid.

## Tech Stack

- **Build:** Vite 7
- **Framework:** React 19 + TypeScript
- **Styling:** Semantic CSS (no Tailwind)
- **Package Manager:** pnpm

## Project Structure

```
covia-pm/
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Entry point
│   └── index.css        # Semantic CSS with Covia colour palette
├── public/
│   └── favicon.svg      # Covia logo
├── index.html           # HTML template
└── vite.config.ts       # Vite configuration
```

## Quick Start

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # Production build
pnpm preview  # Preview production build
```

## Styling Guidelines

This project uses semantic CSS with CSS custom properties. No utility-first frameworks.

### Colour Palette

Derived from app.covia.ai using OKLCH colour space:

- **Primary (Purple):** `--color-primary: oklch(0.5033 0.1829 292.42)`
- **Secondary (Blue):** `--color-secondary: oklch(0.646 0.1423 253.92)`
- **Accent (Gold):** `--color-accent: oklch(0.7957 0.1526 77.54)`

### Component Classes

- `.card` - Card container with border and shadow
- `.button-primary` / `.button-secondary` / `.button-outline` - Button variants
- `.badge` / `.badge-success` / `.badge-error` - Status badges
- `.container` - Centered max-width container
- `.grid-2` / `.grid-3` - Responsive grid layouts

### Dark Mode

Add `.dark` class to `<html>` or `<body>` to enable dark mode.

## Integration

This frontend will connect to the Covia backend using the Python SDK or REST API:

```typescript
// Future: Connect to Covia venue
const venue = await Grid.connect("https://venue.covia.ai");
const status = await venue.status();
```

## Related Repositories

- `covia-repo/` - Backend venue server
- `covia-sdk-py/` - Python SDK
- `frontend/` - Main Covia dashboard (Next.js)
- `covia-pm-phase1/` - Python prototype with Streamlit
