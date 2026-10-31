/**
 * Releases a demo lot the way an inspector does, against the published checklist.
 * Local test stacks only: the answers are synthetic and marked as such.
 * `request(method, path, body)` must act as a quality user and return `{ body }`.
 */
export const releaseThroughQc = async (request, receptionId, { receptionType = "DATTE", pin } = {}) => {
  const checklists = await request("GET", `/api/qc-checklists?receptionType=${receptionType}`);
  const checklist = checklists.body?.data?.[0];
  if (!checklist) throw new Error(`No published QC checklist for ${receptionType}.`);
  const items = await request("GET", `/api/qc-checklists/${checklist.id}/items`);

  const started = await request("POST", "/api/qc/start", { reception_id: receptionId });
  const inspectionId = started.body?.data?.id;
  if (!inspectionId) throw new Error(`QC start failed: ${JSON.stringify(started.body)}`);

  const submitted = await request("POST", "/api/qc/submit", {
    inspectionId,
    decision: "ACCEPTE",
    comment: "Démonstration",
    pin,
    checkResults: items.body.data.map((item) => ({
      checklist_item_id: item.id, check_code: item.code, result: "CONFORME", note: "Script local : aucune mesure réelle",
    })),
  });
  if (!submitted.body?.data) throw new Error(`QC submit failed: ${JSON.stringify(submitted.body)}`);
};
