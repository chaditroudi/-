export interface NCCode {
  code: string;
  label: string;
  category: 'physique' | 'microbiologie' | 'contamination' | 'documentaire';
  severity: 'CRITIQUE' | 'MAJEUR' | 'MINEUR';
  /** check_code from QCCheckResult that auto-triggers this NC */
  autoTriggerOn?: string;
}

export const QC_NC_CODES: NCCode[] = [
  // Physique
  { code: 'NC-HUM-01',   label: 'Humidité hors norme',            category: 'physique',       severity: 'MAJEUR',   autoTriggerOn: 'HUM'  },
  { code: 'NC-CAL-01',   label: 'Calibre sous-standard',          category: 'physique',       severity: 'MAJEUR',   autoTriggerOn: 'CAL'  },
  { code: 'NC-ORG-01',   label: 'Non-conformité organoleptique',  category: 'physique',       severity: 'MAJEUR',   autoTriggerOn: 'ORG'  },
  { code: 'NC-MEC-01',   label: 'Dégâts mécaniques excessifs',    category: 'physique',       severity: 'MINEUR'                          },
  { code: 'NC-CRIST-01', label: 'Cristallisation anormale',       category: 'physique',       severity: 'MINEUR'                          },
  { code: 'NC-COUL-01',  label: 'Décoloration anormale',          category: 'physique',       severity: 'MINEUR'                          },
  // Contamination / microbiologie
  { code: 'NC-INS-01',   label: 'Contamination insectes',         category: 'contamination',  severity: 'CRITIQUE', autoTriggerOn: 'INS'  },
  { code: 'NC-MOLD-01',  label: 'Moisissures détectées',          category: 'microbiologie',  severity: 'CRITIQUE', autoTriggerOn: 'MOLD' },
  { code: 'NC-FERM-01',  label: 'Fermentation détectée',          category: 'microbiologie',  severity: 'CRITIQUE', autoTriggerOn: 'MOLD' },
  { code: 'NC-LAB-01',   label: 'Résultats laboratoire NC',       category: 'microbiologie',  severity: 'CRITIQUE'                        },
  // Documentaire
  { code: 'NC-DOC-01',   label: 'Documentation incomplète',       category: 'documentaire',   severity: 'MINEUR'                          },
  { code: 'NC-TRAÇ-01',  label: 'Traçabilité lot incomplète',     category: 'documentaire',   severity: 'MAJEUR'                          },
];

export const NC_SEVERITY_COLORS: Record<NCCode['severity'], string> = {
  CRITIQUE: 'border-red-300 bg-red-50 text-red-800',
  MAJEUR:   'border-orange-300 bg-orange-50 text-orange-800',
  MINEUR:   'border-yellow-200 bg-yellow-50 text-yellow-800',
};

export const NC_BADGE_VARIANTS: Record<NCCode['severity'], string> = {
  CRITIQUE: 'destructive',
  MAJEUR:   'outline',
  MINEUR:   'secondary',
};

/** Returns all NC codes that match non-conformant check results */
export const getAutoTriggeredNCs = (nonConformantCheckCodes: string[]): NCCode[] =>
  QC_NC_CODES.filter(
    (nc) => nc.autoTriggerOn && nonConformantCheckCodes.includes(nc.autoTriggerOn),
  );
