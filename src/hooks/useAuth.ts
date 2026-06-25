import { useState, useEffect, useCallback } from 'react';
import { mongodb, type User, type Session } from '@/integrations/mongodb/client';
import { ROLE_CONFIG, type ActorRole, type Profile } from '@/types/roles';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: ActorRole[];
  isLoading: boolean;
  isAdmin: boolean;
}

const BUSINESS_ROLE_TO_APP_ROLES: Record<string, ActorRole[]> = {
  // Achats
  achat: ['responsable_achats'],
  achats: ['responsable_achats'],
  responsable_achat: ['responsable_achats'],
  // Réception
  reception: ['responsable_reception'],
  chef_reception: ['chef_reception'],
  // Qualité
  qualite: ['responsable_qualite'],
  quality: ['responsable_qualite'],
  // Stock / Magasin
  magasin: ['responsable_stock'],
  stock: ['responsable_stock'],
  // Production
  production: ['responsable_production'],
  // Logistique
  export: ['responsable_logistique'],
  logistique: ['responsable_logistique'],
  logistics: ['responsable_logistique'],
  // Maintenance
  maintenance: ['responsable_maintenance'],
  // Externes
  audit: ['auditeur_externe'],
  supplier_portal: ['fournisseur_externe'],
  client_portal: ['client_externe'],
  // Direction — mappe vers les deux rôles directeur
  direction: ['directeur_usine', 'directeur_general'],
  direction_usine: ['directeur_usine'],
  direction_generale: ['directeur_general'],
  dg: ['directeur_general'],
  du: ['directeur_usine'],
  // Admin
  admin: ['administrateur_systeme'],
  administrateur: ['administrateur_systeme'],
  // Achats direction
  directeur_achats: ['directeur_achat'],
};

const toActorRoles = (roles: string[]): ActorRole[] => {
  const normalized = new Set<ActorRole>();

  roles
    .map((role) => String(role || '').trim())
    .filter(Boolean)
    .forEach((role) => {
      if (role in ROLE_CONFIG) {
        normalized.add(role as ActorRole);
        return;
      }

      const mappedRoles = BUSINESS_ROLE_TO_APP_ROLES[role] || [];
      mappedRoles.forEach((mappedRole) => normalized.add(mappedRole));
    });

  return Array.from(normalized);
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
};

const buildProfileFromSession = (session: Session | null): Profile | null => {
  const user = session?.user;
  if (!user) return null;

  const metadata = user.user_metadata || {};
  const fullName = String(metadata.full_name || '').trim() || user.email?.split('@')[0] || 'Utilisateur';

  return {
    id: `session-profile-${user.id}`,
    user_id: user.id,
    email: user.email,
    full_name: fullName,
    avatar_url: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
    phone: typeof metadata.phone === 'string' ? metadata.phone : null,
    created_at: '',
    updated_at: '',
  };
};

const getSessionRoles = (session: Session | null) => {
  const metadata = session?.user?.user_metadata || {};
  const rawRoles = [
    // signUp stores a single string under 'role'; other sources use 'roles' array or 'domains'
    ...(metadata.role ? [String(metadata.role)] : []),
    ...toStringArray(metadata.roles),
    ...toStringArray(metadata.domains),
  ];

  return toActorRoles(rawRoles);
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    roles: [],
    isLoading: true,
    isAdmin: false
  });

  const applySessionState = useCallback((session: Session | null) => {
    const user = session?.user ?? null;
    const roles = getSessionRoles(session);
    const isAdmin = roles.some((role) =>
      ['administrateur_systeme', 'directeur_general', 'directeur_usine'].includes(role)
    );

    setState({
      user,
      session,
      profile: buildProfileFromSession(session),
      roles,
      isAdmin,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    // Get initial session
    mongodb.auth.getSession().then(({ data: { session } }) => {
      applySessionState(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = mongodb.auth.onAuthStateChange(
      async (event, session) => {
        applySessionState(session);
      }
    );

    return () => subscription.unsubscribe();
  }, [applySessionState]);

  const signUp = async (email: string, password: string, fullName: string, role: ActorRole) => {
    const { data, error } = await mongodb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role
        }
      }
    });

    if (error) throw error;

    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await mongodb.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await mongodb.auth.signOut();
    if (error) throw error;
  };

  const hasRole = (role: ActorRole): boolean => {
    return state.roles.includes(role);
  };

  const hasAnyRole = (roles: ActorRole[]): boolean => {
    return roles.some(role => state.roles.includes(role));
  };

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    hasRole,
    hasAnyRole
  };
}
