import { describe, expect, it } from 'vitest';

import { describeReceptionAuditEvent, getReceptionNextStep, getReceptionPermissions } from '@/lib/receptionWorkflow';
import type { ReceptionLot } from '@/types/reception';

const lot = (patch: Partial<ReceptionLot>) => ({ id: 'lot', quantity: 100, ...patch }) as ReceptionLot;

describe('getReceptionPermissions', () => {
  it('matches the server role sets', () => {
    expect(getReceptionPermissions(['operateur_reception'])).toEqual({
      canRegister: true, canRunQc: false, canCancel: false, canMoveStock: true,
    });
    // chef_reception registers and cancels but is not a QC role on the server (RG-Q12).
    expect(getReceptionPermissions(['chef_reception'])).toMatchObject({ canRegister: true, canRunQc: false, canCancel: true });
    expect(getReceptionPermissions(['inspecteur_qualite'])).toEqual({
      canRegister: false, canRunQc: true, canCancel: false, canMoveStock: false,
    });
    expect(getReceptionPermissions(['magasinier_wms'])).toMatchObject({ canRegister: false, canMoveStock: true });
  });

  it('lets admin roles act everywhere, like hasAnyRole on the server', () => {
    expect(getReceptionPermissions(['administrateur_systeme'])).toEqual({
      canRegister: true, canRunQc: true, canCancel: true, canMoveStock: true,
    });
  });

  it('grants nothing to unrelated roles', () => {
    expect(getReceptionPermissions(['operateur_conditionnement'])).toEqual({
      canRegister: false, canRunQc: false, canCancel: false, canMoveStock: false,
    });
  });
});

describe('getReceptionNextStep', () => {
  const inspector = getReceptionPermissions(['inspecteur_qualite']);
  const operator = getReceptionPermissions(['operateur_reception']);

  it('offers QC only to quality roles', () => {
    expect(getReceptionNextStep({ status: 'EN_ATTENTE_QC', qc_decision: null }, [], inspector).action).toBe('start_qc');
    const waiting = getReceptionNextStep({ status: 'EN_ATTENTE_QC', qc_decision: null }, [], operator);
    expect(waiting.action).toBeNull();
    expect(waiting.tone).toBe('waiting');
  });

  it('asks to place released lots that have no zone', () => {
    const lots = [lot({ stock_status: 'STOCK_LIBERE', storage_zone_code: null }), lot({ stock_status: 'STOCK_LIBERE', storage_zone_code: 'CF-01' })];
    const step = getReceptionNextStep({ status: 'LIBERE', qc_decision: 'ACCEPTE' }, lots, operator);
    expect(step.action).toBe('assign_storage');
    expect(step.title).toContain('1 lot');
  });

  it('is done once every released lot is placed', () => {
    const lots = [lot({ stock_status: 'STOCK_LIBERE', storage_zone_code: 'CF-01' })];
    expect(getReceptionNextStep({ status: 'LIBERE', qc_decision: 'ACCEPTE' }, lots, operator).tone).toBe('done');
  });

  it('never offers an action on closed receptions', () => {
    const admin = getReceptionPermissions(['administrateur_systeme']);
    expect(getReceptionNextStep({ status: 'REJETE', qc_decision: 'REJETE' }, [], admin).action).toBeNull();
    expect(getReceptionNextStep({ status: 'ANNULE', qc_decision: null }, [], admin).action).toBeNull();
  });
});

describe('describeReceptionAuditEvent', () => {
  it('renders status changes and reasons in French without raw codes', () => {
    const event = describeReceptionAuditEvent({
      action: 'CANCELLED',
      entity_type: 'RECEPTION',
      previous_state: { status: 'EN_ATTENTE_QC' },
      new_state: { status: 'ANNULE', reason: 'Mauvais fournisseur', lot_ids: ['l1'] },
      performed_by: 'u-1',
      performed_by_name: 'Sami Ben Ali',
    });
    expect(event).toEqual({
      label: 'Réception annulée',
      target: 'Réception',
      detail: 'En attente QC → Annulé · Motif : Mauvais fournisseur',
      actor: 'Sami Ben Ali',
    });
  });

  it('describes storage moves and weighings on lots', () => {
    expect(describeReceptionAuditEvent({ action: 'STOCK_MOVE', entity_type: 'LOT', new_state: { zone: 'CF-01', stock_status: 'STOCK_LIBERE' } }).detail)
      .toBe('Zone CF-01');
    expect(describeReceptionAuditEvent({ action: 'WEIGHING_GROSS', entity_type: 'LOT', new_state: { weight_kg: 512.4 } }))
      .toMatchObject({ label: 'Pesée brute du lot', target: 'Lot', detail: '512.4 kg' });
  });

  it('never invents an actor name', () => {
    expect(describeReceptionAuditEvent({ action: 'UPDATE', performed_by: 'u-9' }).actor).toBeNull();
    expect(describeReceptionAuditEvent({ action: 'UPDATE', performed_by: 'system' }).actor).toBe('Système');
  });
});
