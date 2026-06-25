export interface User {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}

export interface Session {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION';
type FilterType = 'eq' | 'in' | 'gte' | 'lte' | 'or';

type QueryFilter = {
  type: FilterType;
  column?: string;
  value: unknown;
};

type OrderBy = {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
};

type SelectRelation = {
  alias: string;
  table: string;
  hint?: string;
  selection: string;
};

type RelationOverride = {
  type?: 'one' | 'many';
  table?: string;
  localKey?: string;
  foreignKey?: string;
};

type RealtimeHandler = {
  event: string;
  filter: {
    event?: string;
    schema?: string;
    table?: string;
    filter?: string;
  };
  callback: (payload: {
    eventType: string;
    table?: string;
    new?: unknown;
    old?: unknown;
    rows?: unknown[];
    before?: unknown[];
    relatedTables?: string[];
    serverEvent?: ServerRealtimeEvent;
  }) => void;
};

export type ServerRealtimeEvent = {
  id?: string;
  type?: string;
  at?: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'SYNC' | string;
  actorId?: string | null;
  rowIds?: string[];
  rows?: unknown[];
  before?: unknown[];
  relatedTables?: string[];
};

import { axiosClient } from '../../lib/axiosClient';

const AUTH_STORAGE_KEY = 'date-harvest-hub-session';

const authListeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();
const activeChannels = new Set<RealtimeChannel>();
let eventSource: EventSource | null = null;
let eventSourceToken: string | null = null;
let reconnectTimer: number | null = null;

const RELATION_OVERRIDES: Record<string, Record<string, RelationOverride>> = {
  alerts: {
    batch: { table: 'batches', localKey: 'batch_id' },
    storage_zone: { table: 'storage_zones', localKey: 'storage_zone_id' },
  },
  batches: {
    supplier: { table: 'suppliers', localKey: 'supplier_id' },
    material: { table: 'materials', localKey: 'material_id' },
    storage_zone: { table: 'storage_zones', localKey: 'storage_zone_id' },
  },
  employee_tasks: {
    employee: { table: 'employees', localKey: 'assigned_to' },
  },
  inventory_counts: {
    location: { table: 'stock_locations', localKey: 'location_id' },
    lot: { table: 'stock_lots', localKey: 'lot_id' },
    product: { table: 'products', localKey: 'product_id' },
  },
  material_receptions: {
    supplier: { table: 'suppliers', localKey: 'supplier_id' },
    material: { table: 'materials', localKey: 'material_id' },
  },
  non_conformities: {
    batch: { table: 'batches', localKey: 'batch_id' },
    inspection: { table: 'quality_inspections', localKey: 'inspection_id' },
  },
  production_orders: {
    reception: { table: 'material_receptions', localKey: 'reception_id' },
  },
  production_steps: {
    step_definition: { table: 'production_step_definitions', localKey: 'step_definition_id' },
    quality_checks: { table: 'quality_checks', foreignKey: 'production_step_id', type: 'many' },
  },
  purchase_orders: {
    supplier: { table: 'suppliers', localKey: 'supplier_id' },
    requisition: { table: 'purchase_requisitions', localKey: 'requisition_id' },
    lines: { table: 'purchase_order_lines', foreignKey: 'order_id', type: 'many' },
    receiving_lots: { table: 'purchase_order_receiving_lots', foreignKey: 'purchase_order_id', type: 'many' },
  },
  purchase_order_lines: {
    material: { table: 'materials', localKey: 'material_id' },
    receiving_lots: { table: 'purchase_order_receiving_lots', foreignKey: 'purchase_order_line_id', type: 'many' },
  },
  purchase_order_receiving_lots: {
    reception: { table: 'receptions_v2', localKey: 'reception_id' },
    reception_lot: { table: 'reception_lots', localKey: 'reception_lot_id' },
  },
  purchase_requisitions: {
    material: { table: 'materials', localKey: 'material_id' },
    preferred_supplier: { table: 'suppliers', localKey: 'preferred_supplier_id' },
  },
  qc_checklists: {
    items: { table: 'qc_checklist_items', foreignKey: 'checklist_id', type: 'many' },
  },
  qc_inspections: {
    check_results: { table: 'qc_check_results', foreignKey: 'inspection_id', type: 'many' },
  },
  reception_lots: {
    units: { table: 'reception_units', foreignKey: 'reception_lot_id', type: 'many' },
  },
  receptions_v2: {
    supplier: { table: 'suppliers', localKey: 'supplier_id' },
    material: { table: 'materials', localKey: 'material_id' },
    lots: { table: 'reception_lots', foreignKey: 'reception_id', type: 'many' },
  },
  shipment_lines: {
    product: { table: 'products', localKey: 'product_id' },
    lot: { table: 'stock_lots', localKey: 'lot_id' },
  },
  shipment_preparations: {
    lines: { table: 'shipment_lines', foreignKey: 'shipment_id', type: 'many' },
    missions: { table: 'transport_missions', foreignKey: 'shipment_id', type: 'many' },
  },
  transport_drivers: {
    missions: { table: 'transport_missions', foreignKey: 'driver_id', type: 'many' },
  },
  transport_missions: {
    vehicle: { table: 'transport_vehicles', localKey: 'vehicle_id' },
    driver: { table: 'transport_drivers', localKey: 'driver_id' },
    shipment: { table: 'shipment_preparations', localKey: 'shipment_id' },
    positions: { table: 'transport_position_logs', foreignKey: 'mission_id', type: 'many' },
  },
  transport_position_logs: {
    mission: { table: 'transport_missions', localKey: 'mission_id' },
    vehicle: { table: 'transport_vehicles', localKey: 'vehicle_id' },
    driver: { table: 'transport_drivers', localKey: 'driver_id' },
  },
  transport_vehicles: {
    missions: { table: 'transport_missions', foreignKey: 'vehicle_id', type: 'many' },
  },
  stock_alerts: {
    product: { table: 'products', localKey: 'product_id' },
    lot: { table: 'stock_lots', localKey: 'lot_id' },
    location: { table: 'stock_locations', localKey: 'location_id' },
  },
  stock_lots: {
    product: { table: 'products', localKey: 'product_id' },
    location: { table: 'stock_locations', localKey: 'location_id' },
    storage_location: { table: 'storage_locations', localKey: 'storage_location_id' },
    supplier: { table: 'suppliers', localKey: 'supplier_id' },
    reception_entry_lot: { table: 'reception_lots', localKey: 'reception_lot_id' },
  },
  stock_movements: {
    lot: { table: 'stock_lots', localKey: 'lot_id' },
    product: { table: 'products', localKey: 'product_id' },
    source_location: { table: 'storage_locations', localKey: 'source_location_id' },
    destination_location: { table: 'storage_locations', localKey: 'destination_location_id' },
  },
  storage_locations: {
    storage_zone: { table: 'storage_zones', localKey: 'storage_zone_id' },
  },
  storage_condition_readings: {
    storage_zone: { table: 'storage_zones', localKey: 'storage_zone_id' },
    storage_location: { table: 'storage_locations', localKey: 'storage_location_id' },
  },
  storage_location_movements: {
    source_location: { table: 'storage_locations', localKey: 'source_location_id' },
    destination_location: { table: 'storage_locations', localKey: 'destination_location_id' },
  },
};

const readStoredSession = (): Session | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

const writeStoredSession = (session: Session | null) => {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const emitAuthChange = (event: AuthChangeEvent, session: Session | null) => {
  authListeners.forEach((listener) => listener(event, session));
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const method = (init?.method || 'GET').toUpperCase();
  let data: unknown = undefined;
  if (init?.body) {
    try {
      data = JSON.parse(init.body as string);
    } catch {
      data = init.body;
    }
  }
  const response = await axiosClient.request<T>({ url: path, method, data });
  return response.data;
};

export const apiRequest = request;

const splitTopLevel = (value: string) => {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;

    if (char === ',' && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens;
};

const parseRelations = (selection?: string) => {
  if (!selection || !selection.includes('(')) return [] as SelectRelation[];

  return splitTopLevel(selection)
    .map((token) => token.replace(/\s+/g, ' ').trim())
    .map((token) => {
      const match = token.match(/^(\w+):([\w_]+)(?:!([\w_]+))?\(([\s\S]*)\)$/);
      if (match) {
        return {
          alias: match[1],
          table: match[2],
          hint: match[3],
          selection: match[4],
        } satisfies SelectRelation;
      }
      return null;
    })
    .filter(Boolean) as SelectRelation[];
};

const singularize = (table: string) => {
  if (table.endsWith('ies')) return `${table.slice(0, -3)}y`;
  if (table.endsWith('s')) return table.slice(0, -1);
  return table;
};

const getRelationConfig = (parentTable: string, relation: SelectRelation, row: Record<string, unknown>) => {
  const override = RELATION_OVERRIDES[parentTable]?.[relation.alias];
  const table = override?.table || relation.table;

  if (override?.localKey || relation.hint || `${relation.alias}_id` in row || `${singularize(table)}_id` in row) {
    return {
      type: override?.type || 'one',
      table,
      localKey:
        override?.localKey ||
        relation.hint ||
        (`${relation.alias}_id` in row ? `${relation.alias}_id` : `${singularize(table)}_id`),
    };
  }

  return {
    type: override?.type || 'many',
    table,
    foreignKey:
      override?.foreignKey ||
      `${singularize(parentTable)}_id`,
  };
};

const fetchRows = async (
  table: string,
  filters: QueryFilter[] = [],
  orderBy?: OrderBy,
  limit?: number,
) => {
  const response = await request<{ data: Record<string, unknown>[] }>('/db/query', {
    method: 'POST',
    body: JSON.stringify({ table, filters, orderBy, limit }),
  });

  return response.data || [];
};

const enrichRows = async (
  rows: Record<string, unknown>[],
  table: string,
  selection?: string,
  cache = new Map<string, Record<string, unknown>[]>(),
): Promise<Record<string, unknown>[]> => {
  const relations = parseRelations(selection);
  if (relations.length === 0) return rows;

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const next = { ...row } as Record<string, unknown>;

      for (const relation of relations) {
        const config = getRelationConfig(table, relation, next);

        if (config.type === 'one') {
          const localValue = next[config.localKey as string];
          if (!localValue) {
            next[relation.alias] = null;
            continue;
          }

          const cacheKey = JSON.stringify({
            table: config.table,
            filters: [{ type: 'eq', column: 'id', value: localValue }],
          });

          let relatedRows = cache.get(cacheKey);
          if (!relatedRows) {
            relatedRows = await fetchRows(config.table as string, [{ type: 'eq', column: 'id', value: localValue }]);
            cache.set(cacheKey, relatedRows);
          }

          const nested = await enrichRows(relatedRows, config.table as string, relation.selection, cache);
          next[relation.alias] = nested[0] || null;
        } else {
          const rowId = next.id;
          if (!rowId) {
            next[relation.alias] = [];
            continue;
          }

          const cacheKey = JSON.stringify({
            table: config.table,
            filters: [{ type: 'eq', column: config.foreignKey, value: rowId }],
          });

          let relatedRows = cache.get(cacheKey);
          if (!relatedRows) {
            relatedRows = await fetchRows(config.table as string, [{ type: 'eq', column: config.foreignKey as string, value: rowId }]);
            cache.set(cacheKey, relatedRows);
          }

          next[relation.alias] = await enrichRows(relatedRows, config.table as string, relation.selection, cache);
        }
      }

      return next;
    }),
  );

  return enriched;
};

const parseRealtimeFilter = (value?: string) => {
  if (!value) return null;
  const match = value.match(/^([^=]+)=eq\.(.+)$/);
  if (!match) return null;
  return { column: match[1], value: match[2] };
};

const shouldDispatch = (handler: RealtimeHandler, table: string, eventType: string, payload: { new?: unknown; old?: unknown }) => {
  if (handler.filter.table && handler.filter.table !== table) return false;
  if (handler.filter.event && handler.filter.event !== '*' && handler.filter.event !== eventType) return false;

  const condition = parseRealtimeFilter(handler.filter.filter);
  if (!condition) return true;

  const target = (payload.new || payload.old || {}) as Record<string, unknown>;
  return String(target?.[condition.column] ?? '') === String(condition.value);
};

const emitRealtime = (table: string, eventType: string, payload: { new?: unknown; old?: unknown }) => {
  activeChannels.forEach((channel) => {
    channel.handlers.forEach((handler) => {
      if (shouldDispatch(handler, table, eventType, payload)) {
        handler.callback({ eventType, table, ...payload });
      }
    });
  });
};

const getRealtimeUrl = (token: string) => {
  const base = (axiosClient.defaults.baseURL || '/api').replace(/\/$/, '');
  return `${base}/realtime/events?token=${encodeURIComponent(token)}`;
};

const closeRealtimeConnection = () => {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  eventSourceToken = null;
};

type RealtimeDispatchEntry = {
  table: string;
  new?: unknown;
  old?: unknown;
};

export const getRealtimeDispatchEntries = (event: ServerRealtimeEvent): RealtimeDispatchEntry[] => {
  const rows = Array.isArray(event.rows) ? event.rows : [];
  const before = Array.isArray(event.before) ? event.before : [];
  const primaryTable = String(event.table || '').trim();
  const relatedTables = Array.from(
    new Set((event.relatedTables || []).map((table) => String(table || '').trim()).filter(Boolean)),
  ).filter((table) => table !== primaryTable);

  const primaryEntries =
    primaryTable.length === 0
      ? []
      : rows.length > 0
        ? rows.map((row, index) => ({
            table: primaryTable,
            new: row,
            old: before[index],
          }))
        : [{ table: primaryTable, new: undefined, old: undefined }];

  const relatedEntries = relatedTables.map((table) => ({
    table,
    new: undefined,
    old: undefined,
  }));

  return [...primaryEntries, ...relatedEntries];
};

const dispatchServerRealtimeEvent = (event: ServerRealtimeEvent) => {
  const action = event.action || 'SYNC';
  const rows = Array.isArray(event.rows) ? event.rows : [];
  const before = Array.isArray(event.before) ? event.before : [];

  activeChannels.forEach((channel) => {
    channel.handlers.forEach((handler) => {
      getRealtimeDispatchEntries(event).forEach((entry) => {
        const payload = {
          new: entry.new,
          old: entry.old,
        };

        if (shouldDispatch(handler, entry.table, action, payload)) {
          handler.callback({
            eventType: action,
            table: entry.table,
            new: payload.new,
            old: payload.old,
            rows,
            before,
            relatedTables: event.relatedTables || [],
            serverEvent: event,
          });
        }
      });
    });
  });
};

const scheduleRealtimeReconnect = () => {
  if (reconnectTimer !== null || activeChannels.size === 0) return;

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    ensureRealtimeConnection(true);
  }, 3000);
};

const ensureRealtimeConnection = (forceReconnect = false) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

  const token = readStoredSession()?.access_token || null;
  if (!token || activeChannels.size === 0) {
    closeRealtimeConnection();
    return;
  }

  if (!forceReconnect && eventSource && eventSourceToken === token) return;

  closeRealtimeConnection();
  eventSourceToken = token;
  eventSource = new EventSource(getRealtimeUrl(token));

  eventSource.addEventListener('db-change', (message) => {
    try {
      dispatchServerRealtimeEvent(JSON.parse((message as MessageEvent).data) as ServerRealtimeEvent);
    } catch (error) {
      console.error('Realtime event parse error:', error);
    }
  });

  eventSource.onerror = () => {
    closeRealtimeConnection();
    scheduleRealtimeReconnect();
  };
};

class RealtimeChannel {
  name: string;
  handlers: RealtimeHandler[] = [];

  constructor(name: string) {
    this.name = name;
  }

  on(event: string, filter: RealtimeHandler['filter'], callback: RealtimeHandler['callback']) {
    this.handlers.push({ event, filter, callback });
    return this;
  }

  subscribe() {
    activeChannels.add(this);
    ensureRealtimeConnection();
    return this;
  }

  unsubscribe() {
    activeChannels.delete(this);
    if (activeChannels.size === 0) {
      closeRealtimeConnection();
    }
  }
}

class MongoQueryBuilder implements PromiseLike<{ data: unknown; error: Error | null }> {
  private table: string;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: QueryFilter[] = [];
  private selection = '*';
  private orderBy?: OrderBy;
  private limitBy?: number;
  private payload: unknown = null;
  private expectSingle = false;
  private allowNullSingle = false;
  private withSelection = false;

  constructor(table: string) {
    this.table = table;
  }

  select(selection = '*') {
    this.selection = selection;
    this.withSelection = true;
    return this;
  }

  insert(values: unknown) {
    this.mode = 'insert';
    this.payload = values;
    return this;
  }

  update(values: unknown) {
    this.mode = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: 'in', column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  or(expression: string) {
    this.filters.push({ type: 'or', value: expression });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending,
      nullsFirst: options?.nullsFirst,
    };
    return this;
  }

  limit(value: number) {
    this.limitBy = value;
    return this;
  }

  single() {
    this.expectSingle = true;
    this.allowNullSingle = false;
    return this;
  }

  maybeSingle() {
    this.expectSingle = true;
    this.allowNullSingle = true;
    return this;
  }

  private async execute() {
    try {
      let resultData: unknown = null;

      if (this.mode === 'select') {
        const rows = await fetchRows(this.table, this.filters, this.orderBy, this.limitBy);
        resultData = await enrichRows(rows, this.table, this.selection);
      }

      if (this.mode === 'insert') {
        const response = await request<{ data: Record<string, unknown>[] }>('/db/insert', {
          method: 'POST',
          body: JSON.stringify({
            table: this.table,
            values: this.payload,
          }),
        });

        const rows = response.data || [];
        resultData = this.withSelection ? await enrichRows(rows, this.table, this.selection) : rows;
        rows.forEach((row) => emitRealtime(this.table, 'INSERT', { new: row }));
      }

      if (this.mode === 'update') {
        const response = await request<{ data: Record<string, unknown>[]; before: Record<string, unknown>[] }>('/db/update', {
          method: 'POST',
          body: JSON.stringify({
            table: this.table,
            filters: this.filters,
            values: this.payload,
          }),
        });

        const rows = response.data || [];
        resultData = this.withSelection ? await enrichRows(rows, this.table, this.selection) : rows;
        const beforeMap = new Map((response.before || []).map((row) => [row.id, row]));
        rows.forEach((row) => emitRealtime(this.table, 'UPDATE', { old: beforeMap.get(row.id), new: row }));
      }

      if (this.mode === 'delete') {
        const response = await request<{ data: Record<string, unknown>[] }>('/db/delete', {
          method: 'POST',
          body: JSON.stringify({
            table: this.table,
            filters: this.filters,
          }),
        });

        const rows = response.data || [];
        resultData = rows;
        rows.forEach((row) => emitRealtime(this.table, 'DELETE', { old: row }));
      }

      if (this.expectSingle) {
        const rows = Array.isArray(resultData) ? resultData : [];
        if (rows.length === 0) {
          if (this.allowNullSingle) {
            return { data: null, error: null };
          }
          return { data: null, error: new Error('No rows found') };
        }
        return { data: rows[0], error: null };
      }

      return { data: resultData, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown request error'),
      };
    }
  }

  then<TResult1 = { data: unknown; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const mongodb = {
  auth: {
    async getSession() {
      const storedSession = readStoredSession();
      if (!storedSession?.access_token) {
        return {
          data: { session: null },
          error: null,
        };
      }

      try {
        const response = await request<{ data: { session: Session | null; user: User | null } }>('/auth/session');
        const nextSession = response.data?.session || null;
        writeStoredSession(nextSession);
        return {
          data: { session: nextSession },
          error: null,
        };
      } catch (error) {
        return {
          data: { session: storedSession },
          error: error instanceof Error ? error : null,
        };
      }
    },

    async getUser() {
      const { data } = await this.getSession();
      return {
        data: { user: data.session?.user || null },
        error: null,
      };
    },

    onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => authListeners.delete(callback),
          },
        },
      };
    },

    async signUp(payload: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      const response = await request<{ data: { user: User; session: Session | null } }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        data: response.data,
        error: null,
      };
    },

    async signInWithPassword(payload: { email: string; password: string }) {
      const response = await request<{ data: Session }>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      writeStoredSession(response.data);
      emitAuthChange('SIGNED_IN', response.data);
      ensureRealtimeConnection(true);
      return {
        data: response.data,
        error: null,
      };
    },

    async signOut() {
      writeStoredSession(null);
      closeRealtimeConnection();
      emitAuthChange('SIGNED_OUT', null);
      return { error: null };
    },
  },

  from(table: string) {
    return new MongoQueryBuilder(table);
  },

  async rpc(name: string, args?: Record<string, unknown>) {
    try {
      const response = await request<{ data: unknown }>(`/rpc/${name}`, {
        method: 'POST',
        body: JSON.stringify(args || {}),
      });
      return { data: response.data, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('RPC failed'),
      };
    }
  },

  channel(name: string) {
    return new RealtimeChannel(name);
  },

  removeChannel(channel: RealtimeChannel) {
    channel.unsubscribe();
  },
};
