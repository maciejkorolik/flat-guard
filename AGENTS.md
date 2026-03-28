# Agents

## Important: Use Installed Skills Before Training Data

This project has installed agent skills in `.agents/skills/`. **Do not rely on your training data** for any of the topics covered by these skills. Always read the skill files first to get up-to-date APIs, patterns, and best practices.

## Project Defaults

This project is a Next.js application. Treat Next.js conventions, routing patterns, data fetching patterns, and rendering model as the baseline when making changes.

TypeScript is the project standard. Prefer `.ts` and `.tsx` files, write new code in TypeScript, and avoid introducing plain JavaScript unless there is a strong existing-project reason.

## Installed Skills

### Vercel AI SDK (`.agents/skills/ai-sdk/`)
For building AI-powered features: text generation, streaming, tool calling, structured output, agents, chatbots, RAG, embeddings, and React hooks like `useChat`/`useCompletion`. Read the skill's `SKILL.md` and `references/` before writing any AI SDK code — APIs have changed significantly and your training data is outdated.

### Gemini API (`.agents/skills/gemini-api-dev/`)
For building with Google's Gemini models directly via the Gemini API and SDKs. Covers multimodal content, function calling, structured output, code execution, and embeddings. Read the skill's `SKILL.md` before using any Gemini APIs — model names and SDK patterns have changed.

### Vercel React Best Practices (`.agents/skills/vercel-react-best-practices/`)
Performance optimization guidelines for React and Next.js from Vercel Engineering. 65 rules across 8 categories. Read the skill's `SKILL.md` and relevant `rules/` files when writing, reviewing, or refactoring React/Next.js components.

### Supabase Postgres Best Practices (`.agents/skills/supabase-postgres-best-practices/`)
Postgres performance optimization and best practices from Supabase. Covers query performance, connection management, schema design, RLS, and more. Read the skill's `SKILL.md` and relevant `references/` files when writing SQL, designing schemas, or optimizing database performance.

### shadcn/ui (`.agents/skills/shadcn/`)
For adding, searching, composing, styling, and debugging **shadcn/ui** components, registries, and presets. This repo is configured with `components.json` (style **new-york**, RSC, **lucide** icons, CSS variables, paths under `@/components/ui`). Read the skill's `SKILL.md` first — it defers to the CLI for current project context (`pnpm dlx shadcn@latest info --json`) and links **critical rules** in `rules/` (styling, forms, composition, icons, base vs Radix). When installing components, use the project's package runner, e.g. **`pnpm dlx shadcn@latest add <component>`** (not bare `npx` unless that matches the repo).

## AI Integration Priority

When implementing AI features in this project:

1. **Default: Use the Vercel AI SDK** (`ai` package) — this is the preferred approach for all AI functionality including text generation, streaming, tool calling, agents, and model integration.
2. **Gemini API directly** — only use the Gemini API/SDK (`@google/genai`) when explicitly requested by the developer. Do not default to it.
