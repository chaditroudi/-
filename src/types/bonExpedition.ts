export type ProduitType =
  | "branche_1ere"
  | "branche_2eme"
  | "vrac"
  | "vrac_seche"
  | "branche_seche"
  | "alig_khouat";

export const PRODUIT_LABELS: Record<ProduitType, string> = {
  branche_1ere:  "Branche 1ère",
  branche_2eme:  "Branche 2ème",
  vrac:          "Vrac",
  vrac_seche:    "Vrac Sèche",
  branche_seche: "Branche Sèche",
  alig_khouat:   "Alig / khouat",
};

export const PRODUIT_ORDER: ProduitType[] = [
  "branche_1ere", "branche_2eme", "vrac", "vrac_seche", "branche_seche", "alig_khouat",
];

export interface ExpeditionLigne {
  produit: ProduitType;
  nature_caisse: string | null;
  quantite_caisse: string | null;
  observation: string | null;
}

export type BonExpeditionStatut = "brouillon" | "valide" | "annule";

export interface BonExpedition {
  id: string;
  numero_bon: string;
  annee: number;
  conventionnel: boolean;
  bio_certifie: boolean;
  ggp: boolean;
  lieu: string | null;
  code_fournisseur: string | null;
  fournisseur_id: string | null;
  code_controleur: string | null;
  date_expedition: string;
  numero_camion: string | null;
  nom_chauffeur: string | null;
  lieu_reception: string | null;
  responsable_reception: string | null;
  nom_signataire: string | null;
  lignes: ExpeditionLigne[];
  casse_nature: string | null;
  casse_gc: number | null;
  casse_p: number | null;
  casse_l: number | null;
  statut: BonExpeditionStatut;
  export_order_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BonExpeditionInput = Omit<BonExpedition, "id" | "numero_bon" | "created_at" | "updated_at">;
