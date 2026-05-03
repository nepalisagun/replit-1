# Nexus Agent

## Overview

A personal AI agent web app with PostgreSQL storage, Gemini AI integration, memory/reflection system, document knowledge base, agent event logging, and a dashboard command center.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (pgvector-ready)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Gemini 2.5 Flash via Replit AI Integrations (no API key required)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Architecture

### Artifacts
- `artifacts/agent` — React + Vite frontend (preview path: `/`)
- `artifacts/api-server` — Express API server (preview path: `/api`)

### Database Schema
- `conversations` — Chat sessions
- `messages` — Messages in each conversation (role: user/assistant)
- `memories` — Agent memories (owner, type, importance score, category)
- `documents` — Knowledge base documents (local/web/web_verified sources)
- `agent_events` — Structured agent event log for self-healing
- `tool_health` — Circuit breaker status per tool

### AI Integration
- Gemini 2.5 Flash for streaming chat responses (SSE)
- Uses `@workspace/integrations-gemini-ai` library
- Env vars auto-provisioned: `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Pages
- `/` — Chat interface with streaming AI responses
- `/memories` — Memory bank (CRUD for agent/user memories)
- `/documents` — Knowledge base (local, web, web_verified docs)
- `/events` — Agent event log with status filtering
- `/dashboard` — Command center with stats, tool health, activity feed

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
