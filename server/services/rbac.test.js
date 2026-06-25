// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canAccessRpc, canAccessTable, isSelfServiceRoleAllowed, normalizeRoles } from './rbac.js';

describe('rbac service', () => {
  it('normalizes legacy application roles to business roles', () => {
    expect(normalizeRoles(['responsable_logistique'])).toEqual(expect.arrayContaining(['export', 'magasin']));
    expect(normalizeRoles(['directeur_achat'])).toEqual(['achat']);
    expect(normalizeRoles(['achats'])).toEqual(['achat']);
    expect(normalizeRoles(['responsable_achat'])).toEqual(['achat']);
    expect(normalizeRoles(['administrateur_systeme'])).toEqual(['admin']);
  });

  it('authorizes table access according to mapped business roles', () => {
    expect(canAccessTable(['directeur_achat'], 'purchase_orders', 'write')).toBe(true);
    expect(canAccessTable(['directeur_achat'], 'alerts', 'read')).toBe(true);
    expect(canAccessTable(['responsable_production'], 'suppliers', 'read')).toBe(true);
    expect(canAccessTable(['fournisseur_externe'], 'suppliers', 'read')).toBe(true);
    expect(canAccessTable(['responsable_stock'], 'stock_movements', 'write')).toBe(true);
    expect(canAccessTable(['responsable_stock'], 'purchase_orders', 'write')).toBe(false);
  });

  it('restricts self-service registration from requesting admin roles', () => {
    expect(isSelfServiceRoleAllowed('responsable_production')).toBe(true);
    expect(isSelfServiceRoleAllowed('administrateur_systeme')).toBe(false);
    expect(isSelfServiceRoleAllowed('directeur_general')).toBe(false);
  });

  it('checks RPC access through normalized roles', () => {
    expect(canAccessRpc(['responsable_stock'], 'suggest_lots_for_picking')).toBe(true);
    expect(canAccessRpc(['directeur_achat'], 'suggest_lots_for_picking')).toBe(false);
  });
});
