/** Role sets for reception endpoints. Admin roles pass every check (see hasAnyRole). */

export const RECEPTION_READ_ROLES = [
  "responsable_reception", "chef_reception", "operateur_reception",
  "responsable_qualite", "inspecteur_qualite", "responsable_stock", "magasinier_wms",
];
export const RECEPTION_WRITE_ROLES = [
  "responsable_reception", "chef_reception", "operateur_reception", "responsable_qualite",
];
/** Cancelling a delivery reverses stock and the purchase order: supervisors only. */
export const RECEPTION_CANCEL_ROLES = [
  "responsable_reception", "chef_reception", "responsable_qualite",
];
export const QUALITY_ROLES = [
  "responsable_qualite", "inspecteur_qualite", "resp_management_qualite", "resp_qualite_haccp",
];
export const STORAGE_MOVE_ROLES = [
  ...RECEPTION_WRITE_ROLES, "responsable_stock", "magasinier_wms", "responsable_logistique",
];
