import { useEffect, useState } from 'react';

import { axiosClient } from '@/lib/axiosClient';

type Health = { environment?: string | null; database_host_class?: string };

/** Every stack shows the same screens, so anything but production says what it is. */
export const describeEnvironment = ({ environment, database_host_class: host }: Health): string | null => {
  if (environment === 'production') return null;
  if (environment === 'test') return 'Environnement de test : données fictives';
  if (environment === 'dev') return 'Développement : données fictives';
  if (environment === 'staging') return 'Préproduction';
  if (environment === 'live-dev') return 'Développement sur la base réelle';
  return host === 'remote' ? 'Environnement non déclaré, base distante' : 'Environnement local non déclaré';
};

export const EnvironmentRibbon = () => {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    axiosClient
      .get<Health>('/health')
      .then((response) => { if (active) setLabel(describeEnvironment(response.data)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!label) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-0 z-[60] -translate-x-1/2 rounded-b bg-warning px-3 py-0.5 text-xs font-medium text-warning-foreground"
    >
      {label}
    </div>
  );
};
