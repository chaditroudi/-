# Standards matrix

Checked 2026-09-27 against public sources named below. Numeric limits are not copied into software. A truncated or secondary snippet is not a factory specification.

Status values: VERIFIED (identity and scope of the text), UNVERIFIED (not confirmed from an official text in this session), NOT APPLIED (not encoded as a hard rule).

| Reference | What was verified | Source | Applicability to this MES | Software status |
|---|---|---|---|---|
| CXS 363-2025 Standard for Fresh Dates | Adopted 2025. Applies to commercial fresh dates (`Phoenix dactylifera`) supplied whole and unpitted to the consumer. Excludes fruit that underwent the intentional processes named in Annex B of CXS 360-2020, and excludes dates intended for industrial processing. CAC48 noted EU/Norway/Switzerland reservations on the Extra-class decay tolerance. | FAO text `CXS_363e.pdf`; WHO note on CAC48 adoption (10 Nov 2025); CAC48 report REP25/CAC | Fresh consumer dates only. Not the default for a Tunisian dried Deglet Nour packing plant. | NOT APPLIED as a gate. Do not treat it as the plant specification. |
| CXS 143-1985 Standard for Dates | FAO workspace PDF still presents it as adopted 1985, amended 2019, editorial correction 2023. Scope stated there: commercially prepared whole dates, pitted or unpitted, ready for direct consumption. Not pieces, mashed dates, or industrial use. A CCFA55 meeting note says CAC revoked CXS 143-1985 after folding dates into CXS 360-2020. The two statements were not reconciled from the full CAC decision text in this session. | FAO `CXS_143e.pdf`; CCFA55 report snippet on revocation | Closest Codex commodity text for packed whole dates, if still in force. Revocation status is UNVERIFIED. | NOT APPLIED. Defect and moisture tables were not transcribed. |
| CXS 360-2020 General standard for dried fruits | Cited by CXS 363-2025. Annex content for dates was not opened. | Cross-reference only | Likely home of dried-date provisions if CXS 143 was revoked. | UNVERIFIED. NOT APPLIED. |
| UNECE DDP-08 Dates, 2024 edition | Header of the 2024 edition: adopted 1987, last revised 2024, aligned with the 2022 standard layout, based on ECE/CTCS/WP.7/2024/14. | PDF titled UNECE STANDARD DDP-08, 2024 edition | Commercial quality of dates in trade. Optional unless a customer or authority requires UNECE classes. | NOT APPLIED. Class tolerances were not copied into QC. |
| CXC 1-1969 General principles of food hygiene | Cited by the CXS 143 PDF. The current revision text was not re-read. | Citation inside CXS 143 | Hygiene baseline for food operations. Does not by itself define this plant's CCPs. | PARTIAL in software: CCP evidence, deviations, and signatures exist. The plant HACCP plan is not in the repo. |
| EC 178/2002, EC 852/2004, EU 1169/2011 | Not re-opened on EUR-Lex in this session. | — | EU food law, hygiene, and consumer labelling for export. Article-level obligations are UNVERIFIED here. | UNVERIFIED. Export documents in the app are internal drafts, not official certificates. |
| Tunisian INNORPI date standards, food-safety decrees, organic regime | No NT number or decree was confirmed. | — | Would govern local product and organic claims. | UNVERIFIED. Do not invent an NT code or a rejection percentage as law. |
| ISO 22000, ISO 22005, FSSC 22000, BRCGS, IFS | Not treated as mandatory. Certification is a customer or scheme choice. | — | Optional until a customer contract requires a scheme. | NOT APPLICABLE as a universal gate. |
| GS1 GTIN, SSCC, GS1-128 | Identifier standards exist. A company prefix is issued to the plant; it is not a universal constant. | GS1 general system; code default in repo | SSCC and label payloads are only valid after the plant prefix is configured. | PARTIAL. Helpers exist. Default prefix `09999999` is a placeholder. |
| Organic / EU import organic | Tunisian certification body rules and EU organic import rules were not verified. | — | Segregation of organic and conventional lots is a software control, not a certification. | PARTIAL. `assertNoOrganicConventionalMix` blocks mixed operations. Certificate validity is not a legal determination. |

## Rules that follow from this

- Do not hard-code Codex or UNECE defect percentages as observed QC results.
- Do not mark a lot organic because a checkbox was set.
- Do not print an official phytosanitary, health, or organic certificate. Store the external document and its status.
- Fumigation is required on `PREMIUM_WHOLE` because that is the existing product route in this codebase, not because a Codex article was found that names it CCP-01 for every date plant.
