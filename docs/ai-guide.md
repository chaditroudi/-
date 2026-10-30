# AI Employee Guide

Assistance layer on top of the existing MES. The manufacturing system remains the source of truth. This is not a second workflow engine, stock system, or RBAC.

## Architecture

```text
Employee → React AiGuide → POST /api/ai-guide/ask
        → Context engine (role, screen, lot, stage, permissions)
        → Intent (deterministic first)
        → Optional LLM phrasing
        → Response validator (enums + navigation whitelist)
        → Existing NestJS services / RBAC
```

The LLM never writes MongoDB, never calls Mongoose, and never bypasses guards. Phase 1 actions are `READ`, `EXPLAIN`, `GUIDE`, `NAVIGATE` only.

Registered in `AppModule` as `AiGuideModule`, which imports `TrustModule` for `LotLifecycleService`.

## Context model

Frontend may send: screen/tab, selected lot id, field id, question, UI language, last few chat lines, optional error code.

Backend ignores any role or permission from the client. It reads JWT `user_metadata` through `getRequestRoles` (same helper as HTTP and SSE).

Compact object sent to the model (after budget):

- `role`, `screen`, `language`
- `workflow.stage`, `status`, `allowedActions`, `blockingReason`
- `entity` `{ type: LOT, id }` when a lot is selected
- one procedure snippet, one screen/field help line, one error explanation
- `userQuestion`
- at most `AI_GUIDE_MAX_HISTORY_MESSAGES` short lines (default 4)

Not sent: full database, all lots, full golden thread catalog, long chat.

## Token strategy

| Variable | Default |
|---|---|
| `AI_GUIDE_MAX_CONTEXT_CHARS` | 2000 |
| `AI_GUIDE_MAX_HISTORY_MESSAGES` | 4 |
| `AI_GUIDE_MAX_PROCEDURE_CHARS` | 900 |
| `AI_GUIDE_MAX_OUTPUT_TOKENS` | 160 |
| `AI_GUIDE_TIMEOUT_MS` | 20000 |

If the compact JSON exceeds the budget: drop history, then trim procedure, then keep only stage / blocking reason / question. Token estimate is `ceil(chars / 4)`.

Each request logs `AI_GUIDE_REQUEST` with intent, provider, input/output token estimates, latency, and whether fallback ran. Lot payloads are not dumped.

## LLM provider

`AiGuideProvider` with `generate()`. Implementations:

- `disabled` — code default. `AI_GUIDE_ENABLED` is false unless set in `.env`. Tests force this.
- `ollama` — `POST {AI_GUIDE_BASE_URL}/api/generate` with `format: json`. If the configured model is missing, the adapter picks `qwen2.5` then `llama3` from `/api/tags`.

The rest of the app talks only to the interface. No OpenAI SDK.

## Tools (read-only, server-side)

Called by the context engine, not as free LLM function-calling:

| Tool | Source |
|---|---|
| `getCurrentUserContext` | JWT roles |
| `getLotStatus` | `LotLifecycleService.getState` |
| `getAllowedTransitions` | golden-thread missing stage ∩ `STAGE_ACTIONS` roles |
| `getBlockingReason` | error code or `ROLE_NOT_PERMITTED` / `WAITING_ON_QUALITY` |
| `getRelevantStock` | one `stock_lots` row (quantity/status only) |
| `getProcedure` | curated procedure map |
| `getScreenHelp` | curated screen/field map |
| `getErrorExplanation` | curated error map |

Not exposed: Mongo query language, shell, fetch, arbitrary JS.

## Intents

`NEXT_STEP`, `EXPLAIN`, `HOW_TO`, `WHY_BLOCKED`, `CHECKLIST`, `NAVIGATE`, `GENERAL_HELP`.

Obvious phrases (`شنوة نعمل توا؟`, `what should I do now?`, `que faire maintenant?`) are classified without an LLM call.

## Response schema

```json
{
  "intent": "NEXT_STEP",
  "message": "…",
  "nextAction": { "type": "NAVIGATE", "target": "/?tab=quality", "label": "Open QC" },
  "reasonCode": "LOT_NOT_RELEASED",
  "language": "ar",
  "fallbackUsed": false,
  "source": "llm"
}
```

`nextAction.type` is only `NAVIGATE`. `target` must be in `AI_GUIDE_NAV_TARGETS` (`/?tab=…` of existing shell tabs). Invalid JSON → one deterministic fallback, no repair loop.

`nextAction` is omitted when the user's roles cannot perform the next stage, even if the LLM asked to open QC.

## Fallback

If the provider is disabled, times out, errors, or returns invalid JSON, the employee still gets 2–6 sentences (or a short procedure) from lot stage, roles, and the curated knowledge base.

## Security

- Route: `RequireAuthGuard` (JWT).
- Allowed next actions come from `LotLifecycleService` + `STAGE_ACTIONS` role lists (same constants as authorization).
- Packers waiting on QC get `WAITING_ON_QUALITY` and no “Open QC” execute button.
- “Release this lot for me” is classified as a mutation request: the guide explains it cannot execute and, at most, offers navigation if the role already may open that screen.

## Cache

Procedures, screen help, and error texts are static module data. Dynamic lot/stock state is not cached beyond the single request. Do not reuse an LLM answer across lots.

## Multilingual

UI strings go through existing i18next (`fr`, `en`, `ar`) including RTL. The guide answers in the application language sent by the client (`language` field). Content tables hold ar/fr/en for procedures and errors.

## Realtime

No second bus. The header sheet subscribes to the existing SSE singleton. After a `db_change` for a selected lot, if the panel is open and idle, that same question is sent again at most once every 10 seconds. Screen-only questions (no lot) are not replayed on every receptions invalidation. There is no second EventSource.

## Lot selection

The guide uses, in order: the last `data-lot-id` click (stock, reception, production, scan), an explicit scan `setEntityId`, then `?lot=` in the hash URL, plus the active tab as `screen`. Inner tables without `data-lot-id` are still invisible to the guide.

## Enablement

See `.env.example`. Local live setup: `AI_GUIDE_ENABLED=true`, `AI_GUIDE_PROVIDER=ollama`, `AI_GUIDE_MODEL=qwen2.5:7b`, `AI_GUIDE_TIMEOUT_MS=20000`. The code default stays off so a plant without Ollama still boots. This is not a production LLM product: no staging, no SLA, Phase 1 still cannot release, ship, consume, or move stock. `printRQC.ts` lint remains a separate known failure.

## Future safe actions

The response already has `nextAction`. A later phase may add typed actions such as `OPEN_QC_DIALOG` only after they are implemented as calls into existing Nest services behind the same RBAC. Mutation types are not accepted today.
