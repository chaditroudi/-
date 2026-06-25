const META_START = '[DA_META]';
const META_END = '[/DA_META]';

export type RequisitionMeta = {
  site?: string;
  desiredDate?: string;
};

export const parseRequisitionMeta = (
  notes: string | null | undefined,
): { plainNotes: string; meta: RequisitionMeta } => {
  if (!notes) return { plainNotes: '', meta: {} };

  const start = notes.indexOf(META_START);
  const end = notes.indexOf(META_END);

  if (start === -1 || end === -1 || end < start) {
    return { plainNotes: notes.trim(), meta: {} };
  }

  const plainNotes = `${notes.slice(0, start)}${notes.slice(end + META_END.length)}`.trim();
  const jsonRaw = notes.slice(start + META_START.length, end);

  try {
    const meta = JSON.parse(jsonRaw) as RequisitionMeta;
    return { plainNotes, meta };
  } catch {
    return { plainNotes: notes.trim(), meta: {} };
  }
};

export const buildRequisitionNotes = (plainNotes: string, meta: RequisitionMeta): string => {
  const normalized = plainNotes?.trim() || '';
  const hasMeta = Boolean(meta.site || meta.desiredDate);
  if (!hasMeta) return normalized;

  const metaBlock = `${META_START}${JSON.stringify(meta)}${META_END}`;
  return normalized ? `${normalized}\n\n${metaBlock}` : metaBlock;
};
