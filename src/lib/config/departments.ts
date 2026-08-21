// Seed values only. Departments are configurable reference data (Prisma `Department` model,
// see docs/assumptions-and-decisions.md#A4) — this list exists purely to seed the database once;
// application code must always read departments from the database, never from this file.
export const SEED_DEPARTMENTS = [
  { code: 'OCEO', name: 'Office of the CEO' },
  // "Licencing" (not "Licensing") per the client's real org chart — see #A20.
  { code: 'ECON_LICENSING', name: 'Economics and Licencing Department' },
  { code: 'DIGITAL_TRANSFORMATION', name: 'Digital Transformation Department' },
  { code: 'ENGINEERING', name: 'Engineering Department' },
  { code: 'COMPLIANCE', name: 'Compliance and Enforcement Department' },
  // Added for the Directors Submission Portal MVP — the "Corporate Services Director" reviewer
  // role is scoped here. See docs/mvp-directors-portal-plan.md.
  { code: 'CORPORATE_SERVICES', name: 'Corporate Services Department' },
] as const;
