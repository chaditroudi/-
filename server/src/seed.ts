import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import {
  DEFAULT_ADMIN,
  DEMO_MATERIALS,
  DEMO_PRODUCTS,
  DEMO_STOCK_LOCATIONS,
  DEMO_SUPPLIERS,
  FLUX_CODE_CONFIG,
  ORDER_STATUS_CONFIG,
  QC_CHECKLISTS,
  STEP_DEFINITIONS,
  STEP_STATUS_CONFIG,
} from "./config/constants.js";
import { getCollectionModel } from "./db/dynamic-model.js";
import { prepareInsertDocument } from "./db/defaults.js";
import { AuthUserModel } from "./models/auth-user.model.js";

const ensureDocuments = async (collection: string, uniqueField: string, rows: Record<string, unknown>[]) => {
  const Model = getCollectionModel(collection);
  for (const row of rows) {
    const existing = await Model.findOne({ [uniqueField]: row[uniqueField] }).lean().exec();
    if (!existing) {
      const prepared = await prepareInsertDocument(collection, row);
      await Model.create([prepared]);
    }
  }
};

export const seedDatabase = async () => {
  const existingAdmin = await AuthUserModel.findOne({ email: DEFAULT_ADMIN.email }).lean().exec();
  if (!existingAdmin) {
    const now = new Date().toISOString();
    await AuthUserModel.create({
      id: randomUUID(),
      email: DEFAULT_ADMIN.email,
      passwordHash: await bcrypt.hash(DEFAULT_ADMIN.password, 10),
      user_metadata: {
        full_name: DEFAULT_ADMIN.fullName,
        role: DEFAULT_ADMIN.role,
        roles: DEFAULT_ADMIN.roles,
        domains: DEFAULT_ADMIN.domains,
      },
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  } else {
    const legacyPasswordHash = typeof (existingAdmin as any).password_hash === "string"
      ? (existingAdmin as any).password_hash
      : null;

    await AuthUserModel.updateOne(
      { email: DEFAULT_ADMIN.email },
      {
        $set: {
          passwordHash:
            existingAdmin.passwordHash ||
            legacyPasswordHash ||
            await bcrypt.hash(DEFAULT_ADMIN.password, 10),
          user_metadata: {
            ...(existingAdmin.user_metadata || {}),
            full_name: DEFAULT_ADMIN.fullName,
            role: DEFAULT_ADMIN.role,
            roles: DEFAULT_ADMIN.roles,
            domains: DEFAULT_ADMIN.domains,
          },
          is_active: true,
          updated_at: new Date().toISOString(),
        },
      },
    ).exec();
  }

  await ensureDocuments("production_step_definitions", "code", STEP_DEFINITIONS);
  await ensureDocuments("production_flux_codes", "code", FLUX_CODE_CONFIG);
  await ensureDocuments("production_order_statuses", "code", ORDER_STATUS_CONFIG);
  await ensureDocuments("production_step_statuses", "code", STEP_STATUS_CONFIG);
  await ensureDocuments("stock_locations", "code", DEMO_STOCK_LOCATIONS);
  await ensureDocuments("products", "code", DEMO_PRODUCTS);
  await ensureDocuments("materials", "code", DEMO_MATERIALS);
  await ensureDocuments("suppliers", "code", DEMO_SUPPLIERS);

  const ChecklistModel = getCollectionModel("qc_checklists");
  const ChecklistItemsModel = getCollectionModel("qc_checklist_items");

  for (const checklist of QC_CHECKLISTS) {
    let storedChecklist = await ChecklistModel.findOne({ code: checklist.code }).lean().exec();
    if (!storedChecklist) {
      const preparedChecklist = await prepareInsertDocument("qc_checklists", {
        code: checklist.code,
        name: checklist.name,
        reception_type: checklist.reception_type,
        description: checklist.description,
        version: checklist.version,
        is_active: true,
      });
      await ChecklistModel.create([preparedChecklist]);
      storedChecklist = preparedChecklist;
    }

    for (const item of checklist.items) {
      const existingItem = await ChecklistItemsModel.findOne({
        checklist_id: storedChecklist.id,
        code: item.code,
      }).lean().exec();

      if (!existingItem) {
        const preparedItem = await prepareInsertDocument("qc_checklist_items", {
          checklist_id: storedChecklist.id,
          code: item.code,
          category: item.category,
          name: item.name,
          severity: item.severity,
          sequence_order: item.sequence_order,
          is_active: true,
        });
        await ChecklistItemsModel.create([preparedItem]);
      }
    }
  }
};
