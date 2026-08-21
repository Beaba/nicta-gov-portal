// Seed values only. Departments are configurable reference data (Prisma `Department` model,
// see docs/assumptions-and-decisions.md#A4) — this list exists purely to seed the database once;
// application code must always read departments from the database, never from this file.
//
// Names below are the client's corrected official list (#A25, 2026-08-22), superseding #A21's
// spelling/wording one day earlier — codes are unchanged (renaming `name` is always safe, per #A4:
// authorization and folder derivation both key off `code`/the live DB `name`, never this file).
export const SEED_DEPARTMENTS = [
  { code: 'OCEO', name: 'Office of the CEO' },
  { code: 'ECON_LICENSING', name: 'Economics and Licensing' },
  { code: 'DIGITAL_TRANSFORMATION', name: 'Digital Transformation' },
  { code: 'ENGINEERING', name: 'Engineering' },
  { code: 'COMPLIANCE', name: 'Enforcement and Compliance' },
  // Added for the Directors Submission Portal MVP — the "Corporate Services Director" reviewer
  // role is scoped here. See docs/mvp-directors-portal-plan.md.
  { code: 'CORPORATE_SERVICES', name: 'Corporate Services' },
] as const;
