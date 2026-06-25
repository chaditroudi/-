export interface BranchLine {
  gc: number | null;
  rp: number | null;
  gcm: number | null;
  l: number | null;
  poid_brut: number | null;
  poid_net: number | null;
  nbre_palette: number | null;
  observation: string | null;
}

export interface BranchSeche extends BranchLine {
  nbre_palette_ajout: number | null;
  nbre_palette_retrait: number | null;
}

export interface CasseLine {
  nature: string;
  quantite: number | null;
}

export type BonStatut = "brouillon" | "valide" | "annule";
export type Region = "el_jirid" | "kebilli" | "autre";

export interface BonReceptionAchat {
  id: string;
  numero_bon: string;
  annee: number;
  convention: boolean;
  bio_certifie: boolean;
  numero_expedition: string | null;
  lieu_expedition: string | null;
  fournisseur_id: string | null;
  fournisseur_nom: string | null;
  numero_facture: string | null;
  date_reception: string;
  heure_arrivee: string | null;
  region: Region;
  numero_lot: string | null;
  numero_camion: string | null;
  nom_chauffeur: string | null;
  lieu_reception: string | null;
  responsable_reception: string | null;
  numero_rapport_qcr: string | null;
  numero_fiche_palette: string | null;
  branche_premiere: BranchLine;
  branche_deuxieme: BranchLine;
  vrac: BranchLine;
  branche_seche: BranchSeche;
  casse: CasseLine[];
  statut: BonStatut;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BonReceptionAchatInput = Omit<BonReceptionAchat, "id" | "numero_bon" | "created_at" | "updated_at">;
