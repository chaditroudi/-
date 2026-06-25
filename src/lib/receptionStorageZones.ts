import type { ReceptionV2 } from '@/types/reception';
import type { Module3StorageZone } from '@/types/storage';

const ACTIVE_RECEPTION_STATUSES = new Set(['BROUILLON', 'EN_ATTENTE_QC', 'EN_QC', 'BLOQUE']);
const INTAKE_STORAGE_FAMILIES = new Set(['reception', 'raw']);

const isQuarantineLikeZone = (zone: Pick<Module3StorageZone, 'code' | 'name'>) => {
  const tokens = `${zone.code} ${zone.name}`.toUpperCase();
  return tokens.includes('QUARAN') || tokens.includes('QZ');
};

export const getReceptionIntakeZones = (zones: Module3StorageZone[]) => {
  return [...zones]
    .filter((zone) => zone.is_active !== false && INTAKE_STORAGE_FAMILIES.has(String(zone.storage_family || '').toLowerCase()))
    .sort((left, right) => {
      const leftRank = left.storage_family === 'reception' ? 0 : 1;
      const rightRank = right.storage_family === 'reception' ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.code.localeCompare(right.code);
    });
};

export const suggestReceptionStorageZone = (params: {
  zones: Module3StorageZone[];
  activeReceptions?: Array<Pick<ReceptionV2, 'status' | 'storage_zone_code'>>;
  arrivalTemperatureC?: number | null;
  requestedZone?: string | null;
}) => {
  const requestedZone = String(params.requestedZone || '').trim().toUpperCase();
  if (requestedZone) return requestedZone;

  const candidates = getReceptionIntakeZones(params.zones);
  if (candidates.length === 0) return '';

  if (typeof params.arrivalTemperatureC === 'number' && params.arrivalTemperatureC > 35) {
    const quarantineCandidate = candidates.find(isQuarantineLikeZone);
    if (quarantineCandidate) return quarantineCandidate.code;
  }

  const receptions = params.activeReceptions || [];

  const rankedCandidates = candidates.map((zone) => ({
    zone,
    load: receptions.filter((reception) => {
      return (
        ACTIVE_RECEPTION_STATUSES.has(String(reception.status || '')) &&
        String(reception.storage_zone_code || '').toUpperCase() === zone.code.toUpperCase()
      );
    }).length,
  }));

  rankedCandidates.sort((left, right) => {
    if (left.load !== right.load) return left.load - right.load;

    const leftRank = left.zone.storage_family === 'reception' ? 0 : 1;
    const rightRank = right.zone.storage_family === 'reception' ? 0 : 1;
    if (leftRank !== rightRank) return leftRank - rightRank;

    return left.zone.code.localeCompare(right.zone.code);
  });

  return rankedCandidates[0]?.zone.code || candidates[0]?.code || '';
};
