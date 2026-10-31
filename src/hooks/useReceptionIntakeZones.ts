import { useMemo } from 'react';

import { useModule3StorageZones } from '@/hooks/useStorageModule3';
import { getReceptionIntakeZones, suggestReceptionStorageZone } from '@/lib/receptionStorageZones';

export const useStorageZonesForIntake = (arrivalTemperatureC: string) => {
  const { data: storageZones = [] } = useModule3StorageZones();
  const zones = useMemo(() => getReceptionIntakeZones(storageZones), [storageZones]);
  const suggestedZone = useMemo(() => {
    const temperature = Number(arrivalTemperatureC.replace(',', '.'));
    return suggestReceptionStorageZone({
      zones,
      arrivalTemperatureC: arrivalTemperatureC.trim() && Number.isFinite(temperature) ? temperature : null,
    });
  }, [arrivalTemperatureC, zones]);
  return { zones, suggestedZone };
};
