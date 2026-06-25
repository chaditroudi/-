import { randomUUID } from 'crypto';

const getActorId = (actor) => actor?.id || 'system';

export const applyCreateAuditFields = (document = {}, actor, performedAt = new Date().toISOString()) => {
  const actorId = getActorId(actor);
  return {
    ...document,
    createdBy: document.createdBy || actorId,
    updatedBy: document.updatedBy || actorId,
    created_by: document.created_by || actorId,
    updated_by: document.updated_by || actorId,
    createdAt: document.createdAt || performedAt,
    updatedAt: document.updatedAt || performedAt,
  };
};

export const applyUpdateAuditFields = (document = {}, actor, performedAt = new Date().toISOString()) => {
  const actorId = getActorId(actor);
  return {
    ...document,
    updatedBy: actorId,
    updated_by: actorId,
    updatedAt: performedAt,
  };
};

export const buildAuditLogEntries = ({
  action,
  table,
  actor,
  requestId,
  beforeRows = [],
  afterRows = [],
  metadata = null,
  performedAt = new Date().toISOString(),
}) => {
  const actorId = getActorId(actor);
  const rows = action === 'DELETE' ? beforeRows : afterRows;

  return rows.map((row, index) => ({
    id: randomUUID(),
    table_name: table,
    entity_id: row?.id || beforeRows[index]?.id || afterRows[index]?.id || null,
    action,
    action_label: `${table}.${action.toLowerCase()}`,
    event_type: `${table}.${action.toLowerCase()}`,
    performed_by: actorId,
    performedBy: actorId,
    performed_at: performedAt,
    performedAt,
    request_id: requestId,
    requestId,
    before: beforeRows[index] || null,
    after: afterRows[index] || null,
    metadata,
  }));
};
