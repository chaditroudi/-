// @vitest-environment node
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCollectionModel } from '../../db/dynamic-model.js';
import { NotificationsService } from './notifications.service.js';

const uri = process.env.RECEPTION_IT_MONGO_URI;
const dbName = 'phase1_notification_visibility_test';
const service = new NotificationsService();
const operator = { roles: ['operateur_reception'], userId: 'operator' };
const supplier = { roles: ['fournisseur_externe'], userId: 'supplier' };
const model = () => getCollectionModel('system_notifications');

describe.skipIf(!uri)('notification visibility on a real local database', () => {
  beforeAll(async () => {
    if (process.env.APP_ENV !== 'test' || !/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(uri!)) throw Error('Local APP_ENV=test database required');
    await mongoose.connect(uri!, { dbName });
    await mongoose.connection.dropDatabase();
    await model().insertMany([
      ...Array.from({ length: 205 }, (_, index) => ({ id: `own-${index}`, title: 'Réception', severity: 'warning', target_roles: ['operateur_reception'], is_read: false })),
      { id: 'internal', target_roles: [], target_user_ids: [], severity: 'info', is_read: false },
      { id: 'supplier', target_roles: [], target_user_ids: ['supplier'], severity: 'error', is_read: false },
      { id: 'stock-secret', target_roles: ['responsable_stock'], title: 'Stock réservé', severity: 'error', is_read: false },
    ]);
  });
  afterAll(async () => { if (mongoose.connection.readyState === 1) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
  it('counts all authorized rows beyond the displayed page without leaking another department', async () => {
    expect((await service.listNotifications({ ...operator, limit: 200 })).length).toBe(200);
    expect(await service.getSummary(operator)).toEqual({ total: 206, unread: 206, warning: 205, critical: 0 });
  });
  it('keeps user-addressed rows private and does not send internal broadcasts to suppliers', async () => {
    expect((await service.listNotifications(supplier)).map(row => row.id)).toEqual(['supplier']);
    expect(await service.getSummary(supplier)).toEqual({ total: 1, unread: 1, critical: 1, warning: 0 });
    expect(await service.getSummary({ roles: [], userId: null })).toEqual({ total: 0, unread: 0, critical: 0, warning: 0 });
  });
  it('refuses acknowledgement of another viewer’s notification without returning its content', async () => {
    await expect(service.markNotificationRead('stock-secret', 'operator', operator)).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    expect((await model().findOne({ id: 'stock-secret' }).lean())?.is_read).toBe(false);
  });
  it('marks only visible notifications read and updates the complete count', async () => {
    await service.markNotificationRead('own-0', 'operator', operator);
    expect((await service.getSummary(operator)).unread).toBe(205);
    await service.markAllNotificationsRead('operator', operator);
    expect((await service.getSummary(operator)).unread).toBe(0);
    expect((await service.getSummary(supplier)).unread).toBe(1);
  });
  it('uses the same visibility scope for statistics and withholds unauthorized audit counts', async () => {
    const stats = await service.getStats(operator);
    expect(stats.total).toBe(206);
    expect(stats.auditLogsLast24h).toBeNull();
  });
});
