# Gate 3 implementation plan

Spec: the user's Gate 3 continuation brief, supplied 4 November 2026.

Goal: enforce an authoritative factory boundary while preserving the pending Gate 1/2 implementation.

Architecture: retain Nest, Mongoose and every domain service. Store authentication in the existing control database; resolve a company (`tenant_id`) and site (`factory_id`) from the active account, bind both into signed sessions, and route operational models to a database namespace derived from that pair and the control database. No browser-selected database, fallback to legacy data, or implicit owner assignment. One active factory membership per account in this phase; company-wide access and membership switching are outside this implementation.

Alternatives considered: adding filters individually leaves omission risks in the many dynamic services; shared-collection middleware adds mutation/aggregation bypass surfaces and requires changing existing unique indexes. A database per factory preserves existing command/index semantics and MongoDB-local lookups. It requires deployment credentials and provisioning that permit these databases; this is a release prerequisite, not verified by local tests.

Constraints: preserve all pre-existing changes and the Git index; no commits, pushes, remote database access or production migration. Reuse CAS, idempotency, quality gates, transaction policy, configuration and UI. Operate here because Gate 2 is pending in this checkout and a clean worktree would omit it. Synthetic factories belong only to isolated local test databases.

Review focus: missing membership or old tokens; direct object references including account administration; deferred jobs and model caches; SSE ticket revocation; legacy records and index initialization failure.

- [x] 1. Record branch/dirty baseline; run TypeScript, build, Gate 1 and Gate 2 tests; inspect manufacturing and costing paths.
- [x] 2. RED/GREEN: unassigned and stale-scope sessions, fresh account reads, fail-closed model resolution; add async factory context and factory-local settings/models/index initialization.
- [x] 3. RED/GREEN: account administration/approver/signature scoping; tenant-safe public settings and startup behavior; bind frontend caches/outbox to the active factory session.
- [x] 4. RED/GREEN: factory-local realtime delivery/counts, live ticket/session revalidation, revocation and disconnect cleanup.
- [x] 5. Prove two independently configured factories on a disposable local MongoDB replica set through real HTTP and database operations: stock, suppliers/customers, documents/reports, quality/production, identical references, concurrency, accounts, events and background context.
- [x] 6a. Add and rehearse non-destructive, explicit legacy inventory and isolated staging-copy tooling. Never infer owners or mutate the existing deployment.
- [ ] 6b. Live cutover/promotion, account activation and rollback acceptance require approved ownership, deployment provisioning and an isolated deployment rehearsal; not implemented or executed here.
- [x] 7. Run regressions/build/typechecks; review the complete diff and preservation evidence; write the required execution report with bounded readiness claims and next industrial acceptance work. Final result: build and all 851 DB-enabled tests pass; full manufacturing/release remains PARTIAL.

Execution: inline, continuing under the user's explicit instruction to implement safe work without stopping at a roadmap. Focused tests precede security behavior changes. A fresh final review follows implementation. No integration/commit step is authorized.

Ruling: scope migration execution to an unreachable staging database because no approved legacy ownership map or deployment target was supplied. Retain source data, refuse unsupported schemas and active/populated destinations, and report live activation/rollback as an explicit release prerequisite. The alternative would risk assigning customer records to the wrong factory.

Review ledger: three Important findings were corrected and independently rechecked (financial totals, settings schema/uniqueness, routable migration destination). Real device negatives, index failure, transaction rollback/SSE suppression and tablet draft tests were added. The full DB-enabled run exposed a settings-fixture model binding failure; collection access now returns a concrete canonical model within the factory scope, matching other collection helpers. Final combined verification is recorded in the execution report.
