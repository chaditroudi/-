import type { User } from '@/integrations/mongodb/client';

export const factoryOwnerKey = (user: Partial<User> | null | undefined): string | null =>
  user?.id && user.tenant_id && user.factory_id ? JSON.stringify([user.id, user.tenant_id, user.factory_id]) : null;

export const factorySessionIdentity = (user: Partial<User> | null | undefined): string | null => {
  const owner = factoryOwnerKey(user);
  return owner ? JSON.stringify([owner, user?.user_metadata ?? {}]) : null;
};

export const readFactorySession = () => {
  try {
    const session = JSON.parse(localStorage.getItem('date-harvest-hub-session') ?? 'null');
    const ownerKey = factoryOwnerKey(session?.user);
    return ownerKey && typeof session?.access_token === 'string'
      ? { ownerKey, userId: session.user.id as string, accessToken: session.access_token as string } : null;
  } catch { return null; }
};

export const storedFactorySessionIdentity = () => {
  try { return factorySessionIdentity(JSON.parse(localStorage.getItem('date-harvest-hub-session') ?? 'null')?.user); }
  catch { return null; }
};
