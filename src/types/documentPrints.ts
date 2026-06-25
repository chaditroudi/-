export type DocumentType =
  | 'BON_RECEPTION'
  | 'BON_EXPEDITION'
  | 'RAPPORT_QC'
  | 'RECLAMATION'
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
  vehicle_number: string;
  driver_name: string;
  lieu_reception: string;
  controleur_code: string;
  responsable_nom: string;
  obs_branche1: string;
  obs_branche2: string;
  obs_vrac: string;
  obs_vrac_sec: string;
  obs_branche_sec: string;
  obs_alig: string;
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
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}
