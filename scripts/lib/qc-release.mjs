/**
 * Releases a demo lot the way an inspector does. The stage override refuses QC
 * outcomes, so scripts go through the same inspection as the application.
 * `post(path, body)` must act as a quality user and return `{ body }`.
 */
export const releaseThroughQc = async (post, receptionId) => {
  const started = await post("/api/qc/start", { reception_id: receptionId });
  const inspectionId = started.body?.data?.id;
  if (!inspectionId) throw new Error(`QC start failed: ${JSON.stringify(started.body)}`);

  const submitted = await post("/api/qc/submit", { inspectionId, decision: "ACCEPTE", comment: "Démonstration" });
  if (!submitted.body?.data) throw new Error(`QC submit failed: ${JSON.stringify(submitted.body)}`);
};
