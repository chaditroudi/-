/**
 * Royal Palm — Production Lines (Flux Matière F1–F8)
 * Source: "Cartographie complète des flux de production" v3.0
 *
 * Common trunk: Palmeraie → Réception (CCP1) → Stockage froid 0–4°C → Tri (aiguillage)
 * Then each sublot is directed to one of the 8 product lines.
 */

// ─── Line codes ──────────────────────────────────────────────────────────────

export type ProductionLineCode =
  | 'F1' 
  | 'F2' // Datte vrac calibrée
  | 'F3' 
  | 'F4' 
  | 'F5'
  | 'F6' 
  | 'F7' // Sucre de datte
  | 'F8'; // Noyaux valorisés

// ─── Support flow codes ───────────────────────────────────────────────────────

export type SupportFlowCode =
  | 'S1'  // Eau
  | 'S2'  // Vapeur / chaleur
  | 'S3'  // Froid
  | 'S4'  // Air comprimé
  | 'S5'  // Énergie électrique
  | 'S6'  // Emballages
  | 'S7'  // Produits nettoyage
  | 'S8'  // Déchets & sous-produits
  | 'S9'  // Personnel
  | 'S10'; // Information / traçabilité

// ─── Per-step definitions ─────────────────────────────────────────────────────

export interface ProductionLineStep {
  /** Position in the sequence (1-based) */
  sequence: number;
  code: string;
  label: string;
  description: string;
  /** Whether this step requires a quality check record */
  requiresQC: boolean;
  /** CCP designation if applicable */
  ccp?: 'CCP1' | 'CCP2';
  /** Expected parameters to capture for this step */
  parameters?: StepParameter[];
}

export interface StepParameter {
  key: string;
  label: string;
  unit: string;
  /** Inclusive acceptable range [min, max] — null means no bound */
  range?: [number | null, number | null];
  type: 'number' | 'boolean' | 'text';
}

// ─── Process parameters per line ─────────────────────────────────────────────

export interface ProductionLineParams {
  /** Final moisture target range [min%, max%] */
  humidity?: [number, number];
  /** Temperature range for drying/etuvage [°C] */
  temperatureRange?: [number, number];
  /** Typical hourly throughput description */
  throughput?: string;
  /** Storage / transport conditions */
  conservationConditions?: string;
  /** Typical packaging formats used */
  packagingFormats?: string[];
  /** Additional notes */
  notes?: string;
}

// ─── Material balance ─────────────────────────────────────────────────────────

export interface ProductionLineBalance {
  /** Typical share of 1 000 kg received, as % range [min, max] */
  yieldRangePercent: [number, number];
  /** Description of final destination / market */
  destination: string;
}

// ─── Full line definition ─────────────────────────────────────────────────────

export interface ProductionLineDefinition {
  code: ProductionLineCode;
  label: string;
  labelFr: string;
  description: string;
  /** Input quality requirement from the triage stage */
  inputQuality: string;
  steps: ProductionLineStep[];
  params: ProductionLineParams;
  balance: ProductionLineBalance;
  /** Hex accent color for UI rendering */
  color: string;
  /** Whether this line produces a derived/valorisation product */
  isDerived: boolean;
  /** Lines that feed into this one (e.g. F8 is fed by F3) */
  fedBy?: ProductionLineCode[];
}

// ─── Definitions sourced from PDF v3.0 ───────────────────────────────────────

export const PRODUCTION_LINE_DEFINITIONS: Record<ProductionLineCode, ProductionLineDefinition> = {
  F1: {
    code: 'F1',
    label: 'Datte branchée',
    labelFr: 'Datte branchée (haut de gamme)',
    description: "La grappe est conservée intacte : produit signature à plus forte valeur. Manipulation manuelle prédominante.",
    inputQuality: 'Premium — grappes entières, aspect irréprochable',
    steps: [
      {
        sequence: 1, code: 'SELECTION_GRAPPE', label: 'Sélection grappes',
        description: 'Choix manuel des plus belles grappes après tri général.',
        requiresQC: true,
      },
      {
        sequence: 2, code: 'NETTOYAGE_DOUX', label: 'Nettoyage doux',
        description: 'Soufflage air + brossage léger — pas de trempage.',
        requiresQC: false,
      },
      {
        sequence: 3, code: 'HYDRATATION_DOUCE', label: 'Hydratation douce',
        description: 'Étuvage à T° basse pour souplesse/brillance sans détacher les dattes.',
        requiresQC: true,
        parameters: [
          { key: 'humidity_out', label: 'Humidité sortie', unit: '%', range: [22, 26], type: 'number' },
        ],
      },
      {
        sequence: 4, code: 'MISE_EN_COFFRET', label: 'Mise en coffret',
        description: 'Calage manuel, pesée individuelle.',
        requiresQC: false,
        parameters: [
          { key: 'weight_g', label: 'Poids coffret (g)', unit: 'g', range: [null, null], type: 'number' },
        ],
      },
      {
        sequence: 5, code: 'DETECTION_METAUX', label: 'Détection métaux',
        description: 'Détecteur en ligne + scellage.',
        requiresQC: true, ccp: 'CCP2',
        parameters: [
          { key: 'metal_detected', label: 'Métal détecté', unit: '', range: [null, null], type: 'boolean' },
          { key: 'etalon_fe_mm', label: 'Étalon Fe (mm)', unit: 'mm', range: [null, null], type: 'number' },
          { key: 'etalon_ss_mm', label: 'Étalon SS (mm)', unit: 'mm', range: [null, null], type: 'number' },
        ],
      },
      {
        sequence: 6, code: 'ETIQUETAGE_EXPEDITION', label: 'Étiquetage / Expédition',
        description: 'Étiquetage, palettisation, chambre froide, reefer.',
        requiresQC: false,
      },
    ],
    params: {
      humidity: [22, 26],
      throughput: '50–150 unités/h selon format',
      conservationConditions: '0–4 °C, expédition reefer',
      packagingFormats: ['Coffret bois/carton', 'Barquette transparente grappe entière'],
    },
    balance: {
      yieldRangePercent: [15, 25],
      destination: 'Export haut de gamme (coffrets, grappes)',
    },
    color: '#D4A017',
    isDerived: false,
  },

  F2: {
    code: 'F2',
    label: 'Datte vrac calibrée',
    labelFr: 'Datte vrac calibrée',
    description: "Produit cœur de gamme : dattes entières détachées, lavées, hydratées, calibrées et emballées.",
    inputQuality: 'Entière bon calibre (≥ 8 g/datte)',
    steps: [
      {
        sequence: 1, code: 'DETACHEMENT', label: 'Détachement',
        description: 'Séparation des dattes de la grappe (manuel + table).',
        requiresQC: false,
      },
      {
        sequence: 2, code: 'TRI_QUALITE', label: 'Tri qualité / corps étrangers',
        description: 'Inspection visuelle et retrait des corps étrangers.',
        requiresQC: true,
      },
      {
        sequence: 3, code: 'LAVAGE_BROSSAGE', label: 'Lavage / brossage',
        description: 'Bac eau tiède 30–35 °C, brosses douces, rinçage, égouttage.',
        requiresQC: false,
        parameters: [
          { key: 'water_temp_c', label: 'T° eau (°C)', unit: '°C', range: [30, 35], type: 'number' },
        ],
      },
      {
        sequence: 4, code: 'HYDRATATION', label: 'Hydratation / étuvage',
        description: '40–60 °C, humidité cible 22–26 %.',
        requiresQC: true,
        parameters: [
          { key: 'temperature_c', label: 'T° étuve (°C)', unit: '°C', range: [40, 60], type: 'number' },
          { key: 'humidity_out', label: 'Humidité sortie (%)', unit: '%', range: [22, 26], type: 'number' },
        ],
      },
      {
        sequence: 5, code: 'CALIBRAGE', label: 'Calibrage pondéral / optique',
        description: 'Gros, moyen, petit calibre (< 8 g / 8–10 g / > 10 g).',
        requiresQC: true,
        parameters: [
          { key: 'caliber_class', label: 'Classe calibre', unit: '', range: [null, null], type: 'text' },
          { key: 'avg_weight_g', label: 'Poids moyen (g)', unit: 'g', range: [null, null], type: 'number' },
        ],
      },
      {
        sequence: 6, code: 'EMBALLAGE', label: 'Emballage',
        description: 'Barquettes 250–500 g, cartons vrac 5–10 kg, sachets.',
        requiresQC: false,
      },
      {
        sequence: 7, code: 'DETECTION_METAUX', label: 'Détection métaux',
        description: 'Détecteur en ligne. CCP2.',
        requiresQC: true, ccp: 'CCP2',
        parameters: [
          { key: 'metal_detected', label: 'Métal détecté', unit: '', range: [null, null], type: 'boolean' },
        ],
      },
      {
        sequence: 8, code: 'ETIQUETAGE_EXPEDITION', label: 'Étiquetage / Expédition',
        description: 'Étiquetage, palettisation, expédition.',
        requiresQC: false,
      },
    ],
    params: {
      humidity: [22, 26],
      temperatureRange: [40, 60],
      throughput: '20–60 unités/min',
      conservationConditions: '0–4 °C jusqu\'à expédition',
      packagingFormats: ['Barquette 250 g', 'Barquette 500 g', 'Carton vrac 5–10 kg', 'Sachet'],
    },
    balance: {
      yieldRangePercent: [30, 40],
      destination: 'Export & marché local, barquettes',
    },
    color: '#C8860A',
    isDerived: false,
  },

  F3: {
    code: 'F3',
    label: 'Datte dénoyautée',
    labelFr: 'Datte dénoyautée',
    description: "Variante du flux vrac avec retrait mécanique du noyau. Le noyau extrait alimente le Flux 8.",
    inputQuality: 'Entière destinée au dénoyautage',
    steps: [
      {
        sequence: 1, code: 'LAVAGE_HYDRATATION', label: 'Lavage + hydratation',
        description: 'Identique Flux 2 (bac eau tiède, étuvage 40–60 °C).',
        requiresQC: true,
        parameters: [
          { key: 'humidity_out', label: 'Humidité sortie (%)', unit: '%', range: [22, 26], type: 'number' },
        ],
      },
      {
        sequence: 2, code: 'DENOYAUTAGE', label: 'Dénoyautage',
        description: 'Dénoyauteuse à poussoirs, contrôle d\'intégrité de la chair.',
        requiresQC: true,
        parameters: [
          { key: 'throughput_kg_h', label: 'Cadence (kg/h)', unit: 'kg/h', range: [300, 800], type: 'number' },
          { key: 'chair_yield_pct', label: 'Rendement chair (%)', unit: '%', range: [85, 88], type: 'number' },
        ],
      },
      {
        sequence: 3, code: 'INSPECTION_RESIDUELLE', label: 'Inspection résiduelle noyaux',
        description: 'Taux noyaux résiduels = 0. Sondage + détecteur configuré.',
        requiresQC: true,
        parameters: [
          { key: 'pit_fragment_found', label: 'Fragment noyau détecté', unit: '', range: [null, null], type: 'boolean' },
        ],
      },
      {
        sequence: 4, code: 'CALIBRAGE_EMBALLAGE', label: 'Calibrage + emballage',
        description: 'Sachets 200 g – 1 kg, vrac industriel 5–10 kg.',
        requiresQC: false,
      },
      {
        sequence: 5, code: 'DETECTION_METAUX', label: 'Détection métaux',
        description: 'CCP2.',
        requiresQC: true, ccp: 'CCP2',
        parameters: [
          { key: 'metal_detected', label: 'Métal détecté', unit: '', range: [null, null], type: 'boolean' },
        ],
      },
      {
        sequence: 6, code: 'ETIQUETAGE_EXPEDITION', label: 'Étiquetage / Expédition',
        description: 'Étiquetage / palettisation / expédition.',
        requiresQC: false,
      },
      {
        sequence: 7, code: 'NOYAUX_VERS_F8', label: 'Noyaux → F8',
        description: 'Noyaux extraits orientés vers Flux 8 valorisation.',
        requiresQC: false,
      },
    ],
    params: {
      humidity: [22, 26],
      temperatureRange: [40, 60],
      throughput: '0,3–0,8 t/h selon machine',
      packagingFormats: ['Sachet 200 g–1 kg', 'Vrac industriel 5–10 kg'],
      notes: 'Taux noyaux résiduels cible = 0. Toute datte avec fragment éliminée ou retraitée.',
    },
    balance: {
      yieldRangePercent: [10, 18],
      destination: 'Sachets, vrac industriel',
    },
    color: '#A0780A',
    isDerived: false,
    fedBy: [],
  },

  F4: {
    code: 'F4',
    label: 'Datte glacée / enrobée',
    labelFr: 'Datte glacée / enrobée',
    description: "Datte recouverte d'un film de sirop pour brillance et présentation premium. Gammes cadeaux.",
    inputQuality: 'Issu F2 (vrac calibrée) — entières ou dénoyautées, hydratées',
    steps: [
      {
        sequence: 1, code: 'RECEPTION_F2', label: 'Issu Flux 2',
        description: 'Dattes entières ou dénoyautées triées et hydratées.',
        requiresQC: false,
      },
      {
        sequence: 2, code: 'TUNNEL_GLACAGE', label: 'Tunnel de glaçage',
        description: 'Pulvérisation sirop glucose/eau ou sirop de datte sur tapis.',
        requiresQC: true,
        parameters: [
          { key: 'syrup_dosage_pct', label: 'Dosage sirop (% poids)', unit: '%', range: [1, 8], type: 'number' },
        ],
      },
      {
        sequence: 3, code: 'SECHAGE_SURFACE', label: 'Séchage de surface',
        description: 'Air pulsé tiède ~30–35 °C pour fixer le film, éviter le collage.',
        requiresQC: false,
        parameters: [
          { key: 'air_temp_c', label: 'T° air (°C)', unit: '°C', range: [30, 35], type: 'number' },
        ],
      },
      {
        sequence: 4, code: 'REFROIDISSEMENT', label: 'Refroidissement / stabilisation',
        description: 'Refroidissement contrôlé avant emballage.',
        requiresQC: false,
      },
      {
        sequence: 5, code: 'EMBALLAGE_PREMIUM', label: 'Emballage premium',
        description: 'Coffrets, barquettes premium, blisters.',
        requiresQC: false,
      },
      {
        sequence: 6, code: 'DETECTION_METAUX', label: 'Détection métaux',
        description: 'CCP2.',
        requiresQC: true, ccp: 'CCP2',
        parameters: [
          { key: 'metal_detected', label: 'Métal détecté', unit: '', range: [null, null], type: 'boolean' },
        ],
      },
      {
        sequence: 7, code: 'ETIQUETAGE_EXPEDITION', label: 'Étiquetage / Expédition',
        description: 'Étiquetage, palettisation, expédition.',
        requiresQC: false,
      },
    ],
    params: {
      humidity: [22, 26],
      temperatureRange: [30, 35],
      packagingFormats: ['Coffret cadeau', 'Barquette premium', 'Blister'],
      notes: 'Marché: coffrets cadeau, Ramadan, fêtes de fin d\'année.',
    },
    balance: {
      yieldRangePercent: [5, 10],
      destination: 'Gammes premium détail',
    },
    color: '#E8B84B',
    isDerived: false,
    fedBy: ['F2'],
  },

  F5: {
    code: 'F5',
    label: 'Pâte de datte',
    labelFr: 'Pâte de datte',
    description: "Valorisation des écarts : dattes molles, abîmées, hors-calibre → matière première industrielle.",
    inputQuality: 'Écarts de tri (dattes molles, fissurées, hors-calibre)',
    steps: [
      {
        sequence: 1, code: 'ECARTS_TRI', label: 'Écarts de tri',
        description: 'Réception dattes molles, fissurées, hors-calibre.',
        requiresQC: false,
      },
      {
        sequence: 2, code: 'LAVAGE', label: 'Lavage',
        description: 'Bac eau tiède + égouttage.',
        requiresQC: false,
      },
      {
        sequence: 3, code: 'DENOYAUTAGE_IND', label: 'Dénoyautage industriel',
        description: 'Dénoyauteuse dédiée pour écarts.',
        requiresQC: false,
      },
      {
        sequence: 4, code: 'BROYAGE_MALAXAGE', label: 'Broyage / malaxage',
        description: 'Broyeur à vis ou meules pour pâte homogène.',
        requiresQC: true,
        parameters: [
          { key: 'texture_ok', label: 'Texture homogène', unit: '', range: [null, null], type: 'boolean' },
          { key: 'humidity_pct', label: 'Humidité pâte (%)', unit: '%', range: [18, 22], type: 'number' },
        ],
      },
      {
        sequence: 5, code: 'PASTEURISATION', label: 'Pasteurisation',
        description: 'Chauffage maîtrisé selon recette.',
        requiresQC: true,
        parameters: [
          { key: 'temp_c', label: 'T° pasteurisation (°C)', unit: '°C', range: [null, null], type: 'number' },
          { key: 'duration_min', label: 'Durée (min)', unit: 'min', range: [null, null], type: 'number' },
        ],
      },
      {
        sequence: 6, code: 'MISE_EN_BLOC', label: 'Mise en bloc',
        description: 'Blocs filmés 5/10 kg, seaux, doypacks.',
        requiresQC: false,
      },
      {
        sequence: 7, code: 'DETECTION_METAUX_EXPEDITION', label: 'Détection métaux + Expédition',
        description: 'Détection métaux + étiquetage + palettisation + expédition.',
        requiresQC: true, ccp: 'CCP2',
        parameters: [
          { key: 'metal_detected', label: 'Métal détecté', unit: '', range: [null, null], type: 'boolean' },
        ],
      },
    ],
    params: {
      humidity: [18, 22],
      packagingFormats: ['Bloc filmé 5 kg', 'Bloc filmé 10 kg', 'Seau', 'Doypack 250 g–1 kg'],
      notes: 'Marchés : pâtisserie industrielle, barres énergétiques, fourrages, GMS.',
    },
    balance: {
      yieldRangePercent: [6, 10],
      destination: 'Industrie agro, boulangerie/pâtisserie',
    },
    color: '#8B6914',
    isDerived: true,
  },

  F6: {
    code: 'F6',
    label: 'Sirop de datte',
    labelFr: 'Sirop de datte (« miel de datte »)',
    description: "Édulcorant naturel par extraction aqueuse des sucres puis concentration sous vide.",
    inputQuality: 'Écarts ou pâte intermédiaire',
    steps: [
      {
        sequence: 1, code: 'ECARTS_ENTREE', label: 'Écarts / pâte en entrée',
        description: 'Réception écarts ou pâte intermédiaire.',
        requiresQC: false,
      },
      {
        sequence: 2, code: 'EXTRACTION_AQUEUSE', label: 'Extraction aqueuse',
        description: 'Trempage / cuisson douce en eau chaude pour solubiliser les sucres.',
        requiresQC: false,
      },
      {
        sequence: 3, code: 'PRESSAGE_FILTRATION', label: 'Pressage / filtration',
        description: 'Séparation du jus et des fibres.',
        requiresQC: false,
      },
      {
        sequence: 4, code: 'CLARIFICATION', label: 'Clarification',
        description: 'Filtration fine, éventuellement décantation.',
        requiresQC: true,
        parameters: [
          { key: 'turbidity_ntu', label: 'Turbidité (NTU)', unit: 'NTU', range: [null, null], type: 'number' },
        ],
      },
      {
        sequence: 5, code: 'CONCENTRATION_VIDE', label: 'Concentration sous vide',
        description: 'Évaporateur, atteint 70–78 °Brix.',
        requiresQC: true,
        parameters: [
          { key: 'brix', label: '°Brix final', unit: '°Brix', range: [70, 78], type: 'number' },
          { key: 'temp_c', label: 'T° évaporateur (°C)', unit: '°C', range: [60, 80], type: 'number' },
        ],
      },
      {
        sequence: 6, code: 'PASTEURISATION_FINALE', label: 'Pasteurisation finale',
        description: 'Traitement thermique final.',
        requiresQC: true,
      },
      {
        sequence: 7, code: 'CONDITIONNEMENT_EXPEDITION', label: 'Conditionnement + Expédition',
        description: 'Flacons verre/PET, fûts, bag-in-box industriels. Détection métaux.',
        requiresQC: true, ccp: 'CCP2',
        parameters: [
          { key: 'metal_detected', label: 'Métal détecté', unit: '', range: [null, null], type: 'boolean' },
        ],
      },
    ],
    params: {
      temperatureRange: [60, 80],
      packagingFormats: ['Bouteille 250–500 mL', 'Fût 25 kg', 'Bag-in-box 10–20 L'],
      notes: '°Brix cible 70–78. Couleur ambrée à brun foncé. Tourteau valorisable en aliment animal.',
    },
    balance: {
      yieldRangePercent: [3, 6],
      destination: 'Édulcorant naturel',
    },
    color: '#B5651D',
    isDerived: true,
  },

  F7: {
    code: 'F7',
    label: 'Sucre de datte',
    labelFr: 'Sucre de datte',
    description: "Poudre brune par séchage poussé puis broyage fin. Marché substitut sucre naturel.",
    inputQuality: 'Dattes dénoyautées de bonne qualité gustative, surplus',
    steps: [
      {
        sequence: 1, code: 'DATTES_SURPLUS', label: 'Dattes dénoyautées surplus',
        description: 'Dattes de bonne qualité gustative en surplus.',
        requiresQC: false,
      },
      {
        sequence: 2, code: 'TRANCHAGE', label: 'Tranchage / fragmentation',
        description: 'Réduction mécanique de la taille.',
        requiresQC: false,
      },
      {
        sequence: 3, code: 'SECHAGE_POUSSE', label: 'Séchage poussé',
        description: 'Étuve à 60–70 °C jusqu\'à humidité résiduelle < 5 %.',
        requiresQC: true,
        parameters: [
          { key: 'temp_c', label: 'T° séchage (°C)', unit: '°C', range: [60, 70], type: 'number' },
          { key: 'humidity_residual_pct', label: 'Humidité résiduelle (%)', unit: '%', range: [null, 5], type: 'number' },
        ],
      },
      {
        sequence: 4, code: 'BROYAGE_FIN', label: 'Broyage fin',
        description: 'Broyeur à marteaux ou à meules.',
        requiresQC: false,
      },
      {
        sequence: 5, code: 'TAMISAGE', label: 'Tamisage / calibrage granulométrique',
        description: 'Séparation fines / grossières.',
        requiresQC: true,
        parameters: [
          { key: 'granulometry', label: 'Granulométrie', unit: '', range: [null, null], type: 'text' },
        ],
      },
      {
        sequence: 6, code: 'CONDITIONNEMENT_EXPEDITION', label: 'Conditionnement + Expédition',
        description: 'Sachets 200–500 g, vrac industriel. Détection métaux.',
        requiresQC: true, ccp: 'CCP2',
        parameters: [
          { key: 'metal_detected', label: 'Métal détecté', unit: '', range: [null, null], type: 'boolean' },
        ],
      },
    ],
    params: {
      humidity: [0, 5],
      temperatureRange: [60, 70],
      packagingFormats: ['Sachet 200–500 g', 'Vrac industriel'],
      notes: 'Couleur brun caramel. Marchés : substitut sucre, santé/naturel, pâtisserie.',
    },
    balance: {
      yieldRangePercent: [1, 3],
      destination: 'Substitut de sucre, gammes santé',
    },
    color: '#CD853F',
    isDerived: true,
  },

  F8: {
    code: 'F8',
    label: 'Noyaux valorisés',
    labelFr: 'Noyaux de datte valorisés',
    description: "Sous-produit du Flux 3 (dénoyautage) : 10–14 % du tonnage. Co-produit à plusieurs débouchés. Taux de valorisation > 95 %.",
    inputQuality: 'Noyaux issus du dénoyautage F3',
    steps: [
      {
        sequence: 1, code: 'SORTIE_DENOYAUTAGE', label: 'Sortie dénoyautage',
        description: 'Noyaux récupérés par tapis dédié depuis F3.',
        requiresQC: false,
      },
      {
        sequence: 2, code: 'LAVAGE_NOYAUX', label: 'Lavage',
        description: 'Eau pour retirer les résidus de chair.',
        requiresQC: false,
      },
      {
        sequence: 3, code: 'SECHAGE_NOYAUX', label: 'Séchage',
        description: 'Pour stabilité stockage (humidité < 10 %).',
        requiresQC: true,
        parameters: [
          { key: 'humidity_pct', label: 'Humidité (%)', unit: '%', range: [null, 10], type: 'number' },
        ],
      },
      {
        sequence: 4, code: 'TRI_DEPOUSSIERAGE', label: 'Tri / dépoussiérage',
        description: 'Tri mécanique et dépoussiérage.',
        requiresQC: false,
      },
      {
        sequence: 5, code: 'ORIENTATION_DEBOUCHE', label: 'Orientation selon débouché',
        description: 'Aliment animal / Café de noyau / Charbon actif / Cosmétique (huile pression froide).',
        requiresQC: false,
        parameters: [
          { key: 'outlet', label: 'Débouché', unit: '', range: [null, null], type: 'text' },
        ],
      },
      {
        sequence: 6, code: 'CONDITIONNEMENT_EXPEDITION', label: 'Conditionnement + Expédition',
        description: 'Sacs jute, big-bags ou vrac.',
        requiresQC: false,
      },
    ],
    params: {
      humidity: [0, 10],
      packagingFormats: ['Sac jute', 'Big-bag', 'Vrac'],
      notes: 'Débouchés : aliment animal, café de noyau, charbon actif, huile cosmétique. Valorisation > 95 %.',
    },
    balance: {
      yieldRangePercent: [10, 14],
      destination: 'Aliment animal, café de noyau, charbon actif, cosmétique',
    },
    color: '#6B4423',
    isDerived: true,
    fedBy: ['F3'],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const PRODUCTION_LINE_CODES = Object.keys(PRODUCTION_LINE_DEFINITIONS) as ProductionLineCode[];

export const getProductionLine = (code: ProductionLineCode) => PRODUCTION_LINE_DEFINITIONS[code];

/** Returns the CCP2 step for a given line (all lines have one). */
export const getCcp2Step = (code: ProductionLineCode): ProductionLineStep | undefined =>
  PRODUCTION_LINE_DEFINITIONS[code].steps.find((s) => s.ccp === 'CCP2');

/** Material balance table (PDF page 4) — sorted by typical weight share desc. */
export const MATERIAL_BALANCE_TABLE = PRODUCTION_LINE_CODES
  .map((code) => ({
    code,
    ...PRODUCTION_LINE_DEFINITIONS[code].balance,
    label: PRODUCTION_LINE_DEFINITIONS[code].labelFr,
    color: PRODUCTION_LINE_DEFINITIONS[code].color,
  }))
  .sort((a, b) => b.yieldRangePercent[1] - a.yieldRangePercent[1]);

// ─── Support flow definitions ─────────────────────────────────────────────────

export interface SupportFlowDefinition {
  code: SupportFlowCode;
  label: string;
  description: string;
  usages: string[];
  controlPoints?: string[];
}

export const SUPPORT_FLOW_DEFINITIONS: Record<SupportFlowCode, SupportFlowDefinition> = {
  S1: {
    code: 'S1', label: 'Eau',
    description: 'Eau potable process, lavage, glaçage, NEP.',
    usages: ['Lavage dattes', 'Vapeur étuvage / hydratation', 'Glaçage', 'Extraction sirop', 'NEP', 'Sanitaires'],
    controlPoints: ['Analyses microbiologiques régulières', 'Chlore résiduel', 'Conductivité / dureté chaudière'],
  },
  S2: {
    code: 'S2', label: 'Vapeur / chaleur',
    description: 'Chaudière vapeur (gaz/fioul) pour étuvage, concentration sirop, séchage sucre, NEP.',
    usages: ['Chambre étuvage 40–60 °C', 'Évaporateur sirop 60–80 °C', 'Séchage sucre 60–70 °C', 'NEP chaud'],
  },
  S3: {
    code: 'S3', label: 'Froid',
    description: 'Chambres froides 0–4 °C et −18 °C, conteneurs reefer export.',
    usages: ['Chambre 0–4 °C matières & PF', 'Tunnel −18/−20 °C désinsectisation', 'Reefer export'],
    controlPoints: ['Enregistrement T° continu', 'Alarmes hors seuil', 'T° reefer consignée'],
  },
  S4: {
    code: 'S4', label: 'Air comprimé',
    description: 'Éjection trieuse optique, vérins pneumatiques, soufflage, signalétique.',
    usages: ['Éjection trieuse optique', 'Vérins dénoyauteuse/ensacheuse', 'Soufflage séchage surface'],
    controlPoints: ['Filtration alimentaire obligatoire (sans huile, sec)'],
  },
  S5: {
    code: 'S5', label: 'Énergie électrique',
    description: 'Alimentation site : moteurs, automatismes, éclairage, froid, informatique.',
    usages: ['Moteurs lignes production', 'Groupes froids (1er poste conso)', 'Automatismes & informatique'],
    controlPoints: ['Sous-compteurs par atelier', 'kWh/t produit suivi mensuel'],
  },
  S6: {
    code: 'S6', label: 'Emballages',
    description: 'Barquettes, sachets, coffrets, cartons, palettes, flacons.',
    usages: ['Barquettes PET/PP', 'Sachets souples multicouche', 'Coffrets carton/bois', 'Palettes bois', 'Flacons verre/PET'],
    controlPoints: ['Conformité contact alimentaire', 'Déclaration fournisseur archivée', 'NIMP15 palettes export'],
  },
  S7: {
    code: 'S7', label: 'Produits nettoyage',
    description: 'Détergents, désinfectants alimentaires, plan NEP par zone.',
    usages: ['Détergent alcalin matières grasses/sucres', 'Désinfectant en finition', 'NEP circuits fermés'],
    controlPoints: ['Produits homologués alimentaires', 'Vérification ATP / microbiologie', 'Plan documenté par zone'],
  },
  S8: {
    code: 'S8', label: 'Déchets & sous-produits',
    description: 'Eaux usées, déchets solides, emballages usagés, DEEE.',
    usages: ['Eaux usées process', 'Écarts non valorisables', 'Boues évaporation / tourteau', 'Cartons/plastiques usagés'],
    controlPoints: ['Prétraitement eaux (dégrillage, dégraisseur)', 'Tri sélectif recyclage', 'Filières agréées DEEE'],
  },
  S9: {
    code: 'S9', label: 'Personnel',
    description: 'Flux opérateurs marche en avant — vestiaires, zones, sas hygiène.',
    usages: ['Pointage entrée site', 'Vestiaire propre/sale', 'Sas hygiène lave-mains', 'Zones sens unique'],
    controlPoints: ['Tenues dédiées par zone', 'Lavage mains obligatoire', 'Formation HACCP', 'Visites médicales'],
  },
  S10: {
    code: 'S10', label: 'Information / traçabilité',
    description: 'N° de lot, étiquetage, traçabilité, ERP — de la palmeraie au client final.',
    usages: ['N° lot fournisseur → lot interne', 'Étiquettes QR/RFID', 'Enregistrements par étape', 'ERP / MES'],
    controlPoints: ['Identifiant lot traçable palmeraie→client', 'Rappel ciblé par lot', 'Audit log complet'],
  },
};

// ─── HACCP definitions ────────────────────────────────────────────────────────

export interface HaccpCcp {
  code: 'CCP1' | 'CCP2';
  stage: string;
  hazard: string;
  criticalLimit: string;
  monitoring: string;
  correctiveAction: string;
}

export const HACCP_CCPS: HaccpCcp[] = [
  {
    code: 'CCP1',
    stage: 'Réception',
    hazard: 'Biologique (insectes, larves) & humidité hors norme',
    criticalLimit: 'Humidité 18–26 % · 0 insecte vivant',
    monitoring: 'Humidimètre, inspection visuelle, loupe',
    correctiveAction: 'Quarantaine + froid −18 °C ≥ 48 h ou fumigation CO₂ + re-contrôle',
  },
  {
    code: 'CCP2',
    stage: 'Conditionnement (toutes lignes)',
    hazard: 'Physique (corps étranger métallique)',
    criticalLimit: 'Aucun métal détecté ; sensibilité étalons-test',
    monitoring: 'Détecteur en ligne + tests étalons à chaque démarrage et fréquence définie',
    correctiveAction: 'Éjection automatique + isolement + ouverture / contrôle du lot',
  },
];

export interface HaccpPrp {
  code: string;
  label: string;
  description: string;
}

export const HACCP_PRPS: HaccpPrp[] = [
  { code: 'PRP-LOC', label: 'Locaux & équipements', description: 'Conception « marche en avant », surfaces lisses, faciles à nettoyer.' },
  { code: 'PRP-EAU', label: 'Eau & énergie', description: 'Potable, analyses régulières ; réseau process séparé du sanitaire.' },
  { code: 'PRP-NET', label: 'Nettoyage / désinfection', description: 'Plan documenté, produits homologués, vérification ATP / micro.' },
  { code: 'PRP-NUI', label: 'Lutte anti-nuisibles', description: 'Plan dératisation, moustiquaires, pièges, audit prestataire.' },
  { code: 'PRP-MAI', label: 'Maintenance', description: 'Préventive, lubrifiants alimentaires en zone process.' },
  { code: 'PRP-HYG', label: 'Hygiène du personnel', description: 'Tenue, lavage des mains, visites médicales, formation.' },
  { code: 'PRP-FRD', label: 'Chaîne du froid', description: 'Enregistrement T° chambres et reefer, alarmes.' },
  { code: 'PRP-CE', label: 'Maîtrise corps étrangers', description: 'Verre / plastique dur / métal : registre, casse, procédure.' },
  { code: 'PRP-FOU', label: 'Maîtrise fournisseurs', description: 'Cahier des charges, audits, agréments, traçabilité.' },
  { code: 'PRP-CRI', label: 'Gestion crise / rappel', description: 'Procédure documentée, exercices, contacts d\'urgence.' },
];

// ─── KPI definitions (PDF page 17) ───────────────────────────────────────────

export interface KpiDefinition {
  code: string;
  category: 'process' | 'food_safety' | 'resources' | 'logistics';
  label: string;
  definition: string;
  target: string;
  unit: string;
  trendDirection: 'up_good' | 'down_good' | 'at_target';
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  // Process KPIs
  { code: 'KPI-P1', category: 'process', label: 'Taux d\'écart au tri', definition: 'Écarts / entrées triées', target: '< 15 %', unit: '%', trendDirection: 'down_good' },
  { code: 'KPI-P2', category: 'process', label: 'Rendement Premium (F1+F2)', definition: 'Premium / total transformé', target: '55–65 %', unit: '%', trendDirection: 'up_good' },
  { code: 'KPI-P3', category: 'process', label: 'Taux de valorisation matière', definition: 'Matière valorisée / matière reçue', target: '> 95 %', unit: '%', trendDirection: 'up_good' },
  { code: 'KPI-P4', category: 'process', label: 'Conformité humidité finale 22–26 %', definition: 'Lots conformes / total', target: '≥ 98 %', unit: '%', trendDirection: 'up_good' },
  { code: 'KPI-P5', category: 'process', label: 'Rendement dénoyautage (chair)', definition: 'Chair récupérée / datte entière', target: '≈ 85–88 %', unit: '%', trendDirection: 'up_good' },
  // Food safety KPIs
  { code: 'KPI-FS1', category: 'food_safety', label: 'Rejets détecteur métaux', definition: 'Unités éjectées / produites', target: '≈ 0 (suivi tendance)', unit: 'ppm', trendDirection: 'down_good' },
  { code: 'KPI-FS2', category: 'food_safety', label: 'Non-conformités libérées', definition: 'NC sur produit fini libéré', target: '0', unit: 'count', trendDirection: 'down_good' },
  { code: 'KPI-FS3', category: 'food_safety', label: 'Conformité chaîne du froid', definition: 'Relevés T° conformes / total', target: '100 %', unit: '%', trendDirection: 'up_good' },
  { code: 'KPI-FS4', category: 'food_safety', label: 'Réclamations clients', definition: 'Nb / volume expédié', target: 'Tendance ↓', unit: 'count/t', trendDirection: 'down_good' },
  // Resources & environment KPIs
  { code: 'KPI-R1', category: 'resources', label: 'Consommation eau spécifique', definition: 'L d\'eau / kg produit fini', target: 'Réduction annuelle', unit: 'L/kg', trendDirection: 'down_good' },
  { code: 'KPI-R2', category: 'resources', label: 'Consommation énergie spécifique', definition: 'kWh / t produit', target: 'Réduction annuelle', unit: 'kWh/t', trendDirection: 'down_good' },
  { code: 'KPI-R3', category: 'resources', label: 'Taux de recyclage déchets', definition: 'Déchets valorisés / total', target: '↑', unit: '%', trendDirection: 'up_good' },
  { code: 'KPI-R4', category: 'resources', label: 'Pertes matière', definition: 'Pertes / matière entrée', target: '< 3 %', unit: '%', trendDirection: 'down_good' },
  // Logistics KPIs
  { code: 'KPI-L1', category: 'logistics', label: 'OTIF (On Time In Full)', definition: 'Commandes livrées à l\'heure et complètes', target: '≥ 95 %', unit: '%', trendDirection: 'up_good' },
  { code: 'KPI-L2', category: 'logistics', label: 'Délai moyen MP → expédition', definition: 'Temps moyen d\'un lot dans l\'usine', target: 'Tendance ↓', unit: 'jours', trendDirection: 'down_good' },
  { code: 'KPI-L3', category: 'logistics', label: 'Taux de palettes conformes', definition: 'Palettes acceptées export / total', target: '≥ 99 %', unit: '%', trendDirection: 'up_good' },
];
