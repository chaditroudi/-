import { useEffect, useState } from 'react';

import { axiosClient } from '@/lib/axiosClient';
import { describeEnvironment, type EnvironmentHealth } from '@/lib/environmentLabel';

export const EnvironmentRibbon = () => {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    axiosClient
      .get<EnvironmentHealth>('/health')
      .then((response) => { if (active) setLabel(describeEnvironment(response.data)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!label) return null;

  return (
    <div
      role="status"
      className="pointer-events-none above-dock fixed left-1/2 z-[46] -translate-x-1/2 w-max max-w-[calc(100vw-2rem)] truncate rounded-t bg-warning px-3 py-0.5 text-xs font-medium text-warning-foreground"
    >
      {label}
    </div>
  );
};
