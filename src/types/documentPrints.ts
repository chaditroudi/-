export type DocumentType =
  | 'BON_RECEPTION'
  | 'BON_EXPEDITION'
  | 'RAPPORT_QC'
  | 'RECLAMATION'
  | 'BON_RECLAMATION'
  | 'FICHE_PALETTE';

export interface BonReceptionFormData {
  responsable_nom: string;
  rapport_gcr_number: string;
  fiche_palette_number: string;
  obs_branche1: string;
  obs_branche2: string;
  obs_vrac: string;
  obs_seche: string;
  obs_casse: string;
}

export interface BonExpeditionFormData {
  version: number;
  document_number: string;
  year: string;
  document_date: string;
  lieu_expedition: string;
  supplier_code: string;
  supplier_name: string;
  conventional: boolean;
  tn_bio_001: boolean;
  ggp: boolean;
  vehicle_number: string;
  driver_name: string;
  lieu_reception: string;
  controleur_code: string;
  responsable_nom: string;
  signataire_nom: string;
  general_observation: string;
  casse_gc: string;
  casse_p: string;
  casse_l: string;
  products: Record<
    "branche1" | "branche2" | "vrac" | "vrac_sec" | "branche_sec" | "alig_khouat",
    {
      nature_caisse: string;
      quantite_caisse: string;
      observation: string;
      source_lots: string[];
      total_kg: number | null;
    }
  >;
}

export interface RapportQCCriterion {
  test1: string;
  test2: string;
  test3: string;
}

export interface RapportQCFormData {
  poids_tb_kg: string;
  poids_echantillon_kg: string;
  inspector_qc1: string;
  inspector_qc2: string;
  directeur_qc: string;
  criteria: {
    infestee: RapportQCCriterion;
    fermentee: RapportQCCriterion;
    immature: RapportQCCriterion;
    craquele: RapportQCCriterion;
    grasse: RapportQCCriterion;
    seche: RapportQCCriterion;
    tachee: RapportQCCriterion;
    ridee: RapportQCCriterion;
    petit_calibre: RapportQCCriterion;
  };
  conclusion: string;
  observation: string;
  type_branche: boolean;
}

export interface ReclamationFormData {
  nc_description: string;
  impact: '' | 'Faible' | 'Moyen' | 'Important';
  repetitivite: '' | 'Rare' | 'Fréquente';
  prix_definitif_tnd_kg: string;
  actions_correctives: string;
  date_realisation: string;
  verification_efficacite: string;
  responsable_reception_nom: string;
  responsable_achat_nom: string;
  date_cloture: string;
}

// ── Bon de réclamation fournisseur (V02-2023) ──────────────────────────────

export interface BonReclamationEcartRow {
  articule: string;
  qte_fournisseur: string;
  qte_reception: string;
  ecart: string;
}

export interface BonReclamationDeclassementRow {
  articule: string;
  qte: string;
  classe_fournisseur: string;
  classe_reception: string;
}

export interface BonReclamationConclusionRow {
  articule: string;
  taux_tombe_branche: string;
  taux_dechets: string;
  taux_dattes_seches: string;
  action: string;
}

export interface BonReclamationPrixRow {
  articule: string;
  prix_fournisseur: string;
  prix_definitif: string;
}

export interface BonReclamationFormData {
  document_date: string;
  numero_facture_fournisseur: string;
  numero_bon_expedition: string;
  numero_rapport_qualite: string;
  ecarts: BonReclamationEcartRow[];
  ecart_nb: string; // ligne NB sous le tableau écart (ex: "75 GCRP + 9 GCM Branche sèche")
  declassements: BonReclamationDeclassementRow[];
  conclusions: BonReclamationConclusionRow[];
  prix: BonReclamationPrixRow[];
  observation: string;
  responsable_reception_nom: string;
  responsable_achat_nom: string;
  fournisseur_nom: string;
}

export interface FichePaletteFormData {
  date_hydratation: string;
  numero_chambre_hydratation: string;
  heure_entree_hs: string;
  heure_sortie_hs: string;
  date_sechoir: string;
  numero_sechoir: string;
  destination: string;
  taux_infestation_v: boolean;
  taux_fermentation_v: boolean;
  taux_homogeneite_v: boolean;
  traitement_thermique_v: boolean;
  responsable_qc_nom: string;
  responsable_production_nom: string;
}

export type DocumentFormData =
  | BonReceptionFormData
  | BonExpeditionFormData
  | RapportQCFormData
  | ReclamationFormData
  | FichePaletteFormData;

export interface DocumentPrint {
  id?: string;
  document_type: DocumentType;
  source_id: string;
  source_number: string;
  form_data: DocumentFormData;
  template_version?: number;
  print_count?: number;
  last_printed_at?: string | null;
  last_printed_by?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}
