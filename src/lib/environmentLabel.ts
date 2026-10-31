export type EnvironmentHealth = { environment?: string | null; database_host_class?: string };

/** Every stack shows the same screens, so anything but production says what it is. */
export const describeEnvironment = ({ environment, database_host_class: host }: EnvironmentHealth): string | null => {
  if (environment === 'production') return null;
  if (environment === 'test') return 'Environnement de test : données fictives';
  if (environment === 'dev') return 'Développement : données fictives';
  if (environment === 'staging') return 'Préproduction';
  if (environment === 'live-dev') return 'Développement sur la base réelle';
  return host === 'remote' ? 'Environnement non déclaré, base distante' : 'Environnement local non déclaré';
};
