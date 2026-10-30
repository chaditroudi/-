import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import {
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

const INITIAL_ADMIN_ROLE = "administrateur_systeme";
const ADMIN_ROLES = ["admin", INITIAL_ADMIN_ROLE];
const MIN_INITIAL_PASSWORD_LENGTH = 10;

/** Creates the first admin once. Existing accounts are never read back or changed. */
const seedInitialAdmin = async () => {
  const existingAdmin = await AuthUserModel.findOne({ "user_metadata.roles": { $in: ADMIN_ROLES } }).lean().exec();
  if (existingAdmin) return;

  const email = String(process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.INITIAL_ADMIN_PASSWORD || "");
  if (!email || password.length < MIN_INITIAL_PASSWORD_LENGTH) {
    console.warn("No admin account exists: set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (10+ characters).");
    return;
  }

  const now = new Date().toISOString();
  await AuthUserModel.create({
    id: randomUUID(),
    email,
    passwordHash: await bcrypt.hash(password, 10),
    user_metadata: {
      full_name: "System Administrator",
      role: INITIAL_ADMIN_ROLE,
      roles: [INITIAL_ADMIN_ROLE],
    },
    is_active: true,
    must_change_password: true,
    created_at: now,
    updated_at: now,
  });
};

export const seedDatabase = async () => {
  await seedInitialAdmin();

  await ensureDocuments("production_step_definitions", "code", STEP_DEFINITIONS);
  await ensureDocuments("production_flux_codes", "code", FLUX_CODE_CONFIG);
  await ensureDocuments("production_order_statuses", "code", ORDER_STATUS_CONFIG);
  await ensureDocuments("production_step_statuses", "code", STEP_STATUS_CONFIG);
  if (process.env.NODE_ENV !== "production") {
    await ensureDocuments("stock_locations", "code", DEMO_STOCK_LOCATIONS);
    await ensureDocuments("products", "code", DEMO_PRODUCTS);
    await ensureDocuments("materials", "code", DEMO_MATERIALS);
    await ensureDocuments("suppliers", "code", DEMO_SUPPLIERS);
  }

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
