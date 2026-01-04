# AGENTS.md - AI Coding Agent Guidelines

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

**kapso-crafter** is a Next.js 16 application that integrates WhatsApp messaging via Kapso API with Claude AI for automated responses. Uses App Router and deploys on Vercel.

## Tech Stack

- **Runtime**: Bun | **Framework**: Next.js 16.1.1 (App Router) | **Language**: TypeScript 5 (strict)
- **Styling**: Tailwind CSS v4 | **Linting**: Biome 2.2.0 | **AI**: Vercel AI SDK + Anthropic Claude

## Build/Lint/Test Commands

### Package Manager - Always use `bun`:
```bash
bun install          # Install dependencies
bun add <package>    # Add dependency
bun add -d <package> # Add dev dependency
```

### Development:
```bash
bun run dev          # Start dev server (localhost:3000)
bun run build        # Production build
bun run start        # Start production server
```

### Linting and Formatting:
```bash
bun run lint             # Run Biome linter
bun run format           # Auto-format code
bunx biome check --write # Fix lint issues + format
```

### Testing (not yet configured):
```bash
bunx vitest run path/to/test.ts  # Run single test
bunx vitest                       # Watch mode
```

## Code Style Guidelines

### Formatting (Biome)
- **Indent**: 2 spaces | **Quotes**: Double | **Semicolons**: Required

### Imports
```typescript
import type { Metadata } from "next";  // Use 'type' for type-only imports
import { Component } from "@/components/Component";  // Use @/ path alias
```

Import order (auto-organized): External packages -> Internal (`@/...`) -> Relative

### TypeScript
- **Strict mode enabled** - no implicit any, strict null checks
- Use `interface` for object shapes, `type` for unions/intersections
- Explicit return types on exported functions

```typescript
interface KapsoWebhookPayload {
  message: { id: string; type: string };
}

export async function POST(request: Request): Promise<Response> {
  // ...
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components/Files | PascalCase | `UserProfile.tsx` |
| Functions/Variables | camelCase | `getWhatsAppClient` |
| Route files | lowercase | `route.ts`, `page.tsx` |
| Constants | SCREAMING_SNAKE | `API_BASE_URL` |
| Interfaces/Types | PascalCase | `interface UserData` |
| Environment vars | SCREAMING_SNAKE | `KAPSO_API_KEY` |

### React/Next.js Patterns

1. **Functional components only** - no class components
2. **Server Components by default** - use `"use client"` only when needed
3. **App Router conventions**: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`
4. **Always use `next/image`** for images

### Error Handling
```typescript
try {
  const result = await someAsyncOperation();
} catch (error) {
  console.error("Context for error:", error);
}
```

- Use try/catch for async operations
- Log errors with context
- Return appropriate HTTP status codes
- Validate environment variables at runtime

### Environment Variables
- Store in `.env.local` (gitignored)
- Required: `KAPSO_API_KEY`
- Use lazy initialization pattern:

```typescript
function getClient() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY required");
  return new Client({ apiKey });
}
```

## Project Structure
```
src/app/                    # Next.js App Router
  ├── api/webhooks/         # Webhook handlers
  ├── globals.css           # Global styles (Tailwind)
  ├── layout.tsx            # Root layout
  └── page.tsx              # Home page
public/                     # Static assets
```

## Tailwind CSS
- v4 with PostCSS
- Dark mode via `dark:` prefix
- `noUnknownAtRules` off in Biome for `@theme`, `@apply`

## API Route Pattern
```typescript
export async function POST(request: Request) {
  const payload = await request.json();
  // Validate and process
  return new Response("OK", { status: 200 });
}
```

## Pre-commit Checklist
1. `bun run lint` passes
2. `bun run build` succeeds
3. No hardcoded secrets
4. New env vars documented
