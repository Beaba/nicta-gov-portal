// Fictional demo data only — no real NICTA staff, activities, submissions, or governance content.
// Seeds reference data, demo users for every role/department combination (sign-in-able via the
// mock auth "sign in as" picker), and the Milestone 1 demo submissions required by
// docs/milestone-1-plan.md (one draft, one returned for correction, one accepted and routed).
// Idempotent for reference data and users (upserts by natural/unique keys); the three demo
// submissions are created once, guarded by a fixed code in their title so re-running the seed
// does not duplicate them.
import { PrismaClient } from '@prisma/client';
import { SEED_DEPARTMENTS } from '../src/lib/config/departments';
import { SEED_ROLES, type RoleCode } from '../src/lib/config/roles';
import { getReportingWeekFor } from '../src/lib/reporting/weeklyDeadline';

const prisma = new PrismaClient();

const CURRENT_FY = 'FY2026';
const REF_SCOPE = `SMC-${CURRENT_FY.replace('FY', '')}`;

async function main() {
  console.log('Seeding reference data...');

  const departments = new Map<string, string>();
  for (const dept of SEED_DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name },
    });
    departments.set(dept.code, row.id);
  }

  const roles = new Map<RoleCode, string>();
  for (const role of SEED_ROLES) {
    // description holds the role's mirrored NICTA Microsoft 365 security group name, where one
    // exists (see SEED_ROLES's own comment and scripts/provision-graph-security-groups.ts) —
    // documentation/admin-visibility only, never read by authorization logic (#A4).
    const description = 'securityGroupName' in role ? role.securityGroupName : null;
    const row = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description },
      create: { code: role.code, name: role.name, description },
    });
    roles.set(role.code, row.id);
  }

  await prisma.reportingPeriod.upsert({
    where: { code: `${CURRENT_FY}-Q1` },
    update: {},
    create: {
      code: `${CURRENT_FY}-Q1`,
      label: 'FY2026 Quarter 1 (Jan-Mar)',
      periodType: 'Quarterly',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
  });
  await prisma.reportingPeriod.upsert({
    where: { code: `${CURRENT_FY}-Q2` },
    update: {},
    create: {
      code: `${CURRENT_FY}-Q2`,
      label: 'FY2026 Quarter 2 (Apr-Jun)',
      periodType: 'Quarterly',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-06-30'),
    },
  });

  const strategicObjectives = [
    { code: 'SO1', title: 'Expand affordable digital access nationwide' },
    { code: 'SO2', title: 'Strengthen regulatory and licensing effectiveness' },
    { code: 'SO3', title: 'Build organisational and workforce capability' },
    { code: 'SO4', title: 'Advance cybersecurity and consumer protection' },
  ];
  for (const so of strategicObjectives) {
    await prisma.strategicObjective.upsert({
      where: { code: so.code },
      update: { title: so.title },
      create: { code: so.code, title: so.title, financialYear: CURRENT_FY },
    });
  }

  console.log('Seeding Milestone 1 paper types, meeting and templates...');

  // Client's Milestone 1 list: "Start with: Management Report, SMC Information Paper, SMC Decision
  // Paper. Make the list configurable." src/lib/config/paperTypes.ts keeps the fuller SMC/Board
  // lists as the documented next-phase expansion set — not seeded here.
  const paperTypeSeeds = [
    {
      code: 'MANAGEMENT_REPORT',
      name: 'Management Report',
      category: 'SMC' as const,
      requiresRecommendation: false,
    },
    {
      code: 'SMC_INFORMATION_PAPER',
      name: 'SMC Information Paper',
      category: 'SMC' as const,
      requiresRecommendation: false,
    },
    {
      code: 'SMC_DECISION_PAPER',
      name: 'SMC Decision Paper',
      category: 'SMC' as const,
      requiresRecommendation: true,
    },
    // #A30's Board Dashboard spec's exact 5 Board paper types. Board Papers today still inherit
    // their `paperType` string from the source SMC submission (submitBoardPaper in review.ts) —
    // these rows exist as configured reference data per the client's "Support these paper types"
    // requirement, ready for a future Board-paper-type picker, not yet wired to one — see
    // docs/known-limitations.md.
    {
      code: 'BOARD_INFORMATION_PAPER',
      name: 'Information Paper',
      category: 'BOARD' as const,
      requiresRecommendation: false,
    },
    {
      code: 'BOARD_DECISION_PAPER',
      name: 'Decision Paper',
      category: 'BOARD' as const,
      requiresRecommendation: true,
    },
    {
      code: 'BOARD_DISCUSSION_PAPER',
      name: 'Discussion Paper',
      category: 'BOARD' as const,
      requiresRecommendation: false,
    },
    {
      code: 'BOARD_MANAGEMENT_REPORT',
      name: 'Management Report',
      category: 'BOARD' as const,
      requiresRecommendation: false,
    },
    {
      code: 'BOARD_CONFIDENTIAL_PAPER',
      name: 'Confidential Paper',
      category: 'BOARD' as const,
      requiresRecommendation: false,
    },
  ];
  for (const pt of paperTypeSeeds) {
    await prisma.paperType.upsert({
      where: { code: pt.code },
      update: { name: pt.name },
      create: pt,
    });
  }

  const meeting =
    (await prisma.meeting.findFirst({ where: { meetingNumber: 'SMC-2026-03' } })) ??
    (await prisma.meeting.create({
      data: {
        meetingType: 'SMC',
        title: 'Senior Management Committee Meeting — March 2026',
        meetingNumber: 'SMC-2026-03',
        meetingDate: new Date('2026-03-25T09:00:00+10:00'),
        status: 'SCHEDULED',
      },
    }));

  const templateSeeds = [
    {
      code: 'MGMT_REPORT_PLACEHOLDER',
      name: 'Management Report (placeholder template)',
      category: 'ManagementReport',
      paperType: 'Management Report',
    },
    {
      code: 'SMC_INFO_PAPER_PLACEHOLDER',
      name: 'SMC Information Paper (placeholder template)',
      category: 'SMCPaper',
      paperType: 'SMC Information Paper',
    },
    {
      code: 'SMC_DECISION_PAPER_PLACEHOLDER',
      name: 'SMC Decision Paper (placeholder template)',
      category: 'SMCPaper',
      paperType: 'SMC Decision Paper',
    },
  ];
  const templateIds = new Map<string, string>();
  for (const t of templateSeeds) {
    const row = await prisma.template.upsert({
      where: { code: t.code },
      update: { name: t.name, paperType: t.paperType },
      create: {
        code: t.code,
        name: t.name,
        category: t.category,
        paperType: t.paperType,
        filePath: `templates/${t.code.toLowerCase()}.docx`,
        isPlaceholder: true,
        isActive: true,
      },
    });
    templateIds.set(t.paperType, row.id);
  }

  console.log('Seeding demo users...');

  const ceo = await upsertUser({
    email: 'ceo.demo@nicta.gov.pg',
    name: 'Ambrose Kaviamu (Demo CEO)',
    jobTitle: 'Chief Executive Officer',
    departmentCode: null,
    roleAssignments: [{ role: 'EXECUTIVE_VIEWER', departmentCode: null }],
  });
  await upsertUser({
    email: 'smc.secretariat.demo@nicta.gov.pg',
    name: 'Grace Wamun (Demo SMC Secretariat)',
    jobTitle: 'OCEO / SMC Secretariat Officer',
    departmentCode: 'OCEO',
    roleAssignments: [{ role: 'SMC_SECRETARIAT', departmentCode: null }],
  });
  await upsertUser({
    email: 'board.secretariat.demo@nicta.gov.pg',
    name: 'Peter Nou (Demo Board Secretariat)',
    jobTitle: 'Board Secretariat Officer',
    departmentCode: 'OCEO',
    roleAssignments: [{ role: 'BOARD_SECRETARIAT', departmentCode: null }],
  });
  await upsertUser({
    email: 'smc.member.demo@nicta.gov.pg',
    name: 'Dr. Ilaisa Bogosa (Demo SMC Member)',
    jobTitle: 'SMC Member',
    departmentCode: null,
    roleAssignments: [{ role: 'SMC_MEMBER', departmentCode: null }],
  });
  const admin = await upsertUser({
    email: 'admin.demo@nicta.gov.pg',
    name: 'Serah Kombra (Demo System Administrator)',
    jobTitle: 'IT Systems Administrator',
    departmentCode: 'DIGITAL_TRANSFORMATION',
    roleAssignments: [{ role: 'SYSTEM_ADMIN', departmentCode: null }],
  });
  // Board Members — read-only access to the Board Papers register (submissionCategory: 'BOARD'
  // only, enforced in assertCanAccessSubmission). Org-wide like CEO. No real Board Member names
  // were given by the client; these are placeholder demo accounts, same as CEO/Admin above.
  await upsertUser({
    email: 'board.member1.demo@nicta.gov.pg',
    name: 'James Nou (Demo Board Member)',
    jobTitle: 'Board Member',
    departmentCode: null,
    roleAssignments: [{ role: 'BOARD_MEMBER', departmentCode: null }],
  });
  await upsertUser({
    email: 'board.member2.demo@nicta.gov.pg',
    name: 'Winnie Kaupa (Demo Board Member)',
    jobTitle: 'Board Member',
    departmentCode: null,
    roleAssignments: [{ role: 'BOARD_MEMBER', departmentCode: null }],
  });

  // Directors Submission Portal MVP workflow users — see docs/mvp-directors-portal-plan.md.
  const submitter = await upsertUser({
    email: 'submitter.demo@nicta.gov.pg',
    name: 'Rachel Kaupa (Demo Director)',
    jobTitle: 'Director, Economics and Licensing',
    departmentCode: 'ECON_LICENSING',
    roleAssignments: [{ role: 'SUBMITTER', departmentCode: 'ECON_LICENSING' }],
  });
  const reviewer = await upsertUser({
    email: 'reviewer.demo@nicta.gov.pg',
    name: 'Thomas Iga (Demo Corporate Secretary)',
    jobTitle: 'Corporate Secretary',
    departmentCode: 'CORPORATE_SERVICES',
    roleAssignments: [{ role: 'REVIEWER_SECRETARIAT', departmentCode: null }],
  });

  // Departments now covered by a real named Director in REAL_ROSTER below (seeded further down) —
  // the fictional per-department demo director is skipped entirely for these so a fresh `db:seed`
  // never recreates them, see #A20. OCEO has no real Director in the roster (the CEO persona sits
  // there), so it keeps its demo one.
  const REAL_ROSTER_DEPARTMENTS = new Set([
    'ECON_LICENSING',
    'DIGITAL_TRANSFORMATION',
    'ENGINEERING',
    'COMPLIANCE',
    'CORPORATE_SERVICES',
  ]);

  const directorNames: Record<string, string> = {
    OCEO: 'Michael Waim (Demo Director)',
  };
  const managerNamePairs: Record<string, [string, string]> = {
    OCEO: ['Anna Meli (Demo Manager)', 'David Susuve (Demo Manager)'],
    ECON_LICENSING: ['Naomi Pes (Demo Manager)', 'Robert Kaiwi (Demo Manager)'],
    DIGITAL_TRANSFORMATION: ['Lucy Waroi (Demo Manager)', 'Timothy Bola (Demo Manager)'],
    ENGINEERING: ['Esther Manuai (Demo Manager)', 'James Kaupa (Demo Manager)'],
    COMPLIANCE: ['Margaret Sowei (Demo Manager)', 'George Lahui (Demo Manager)'],
  };

  for (const dept of SEED_DEPARTMENTS) {
    if (!REAL_ROSTER_DEPARTMENTS.has(dept.code)) {
      await upsertUser({
        email: `director.${dept.code.toLowerCase()}.demo@nicta.gov.pg`,
        name: directorNames[dept.code] ?? `${dept.name} Director (Demo)`,
        jobTitle: `Director, ${dept.name}`,
        departmentCode: dept.code,
        roleAssignments: [{ role: 'DIRECTOR', departmentCode: dept.code }],
      });
    }

    const [mgr1, mgr2] = managerNamePairs[dept.code] ?? [
      `${dept.code} Manager 1`,
      `${dept.code} Manager 2`,
    ];
    await upsertUser({
      email: `manager1.${dept.code.toLowerCase()}.demo@nicta.gov.pg`,
      name: mgr1,
      jobTitle: `Manager, ${dept.name}`,
      departmentCode: dept.code,
      roleAssignments: [{ role: 'MANAGER', departmentCode: dept.code }],
    });
    await upsertUser({
      email: `manager2.${dept.code.toLowerCase()}.demo@nicta.gov.pg`,
      name: mgr2,
      jobTitle: `Manager, ${dept.name}`,
      departmentCode: dept.code,
      roleAssignments: [{ role: 'MANAGER', departmentCode: dept.code }],
    });
  }

  console.log('Seeding real NICTA roster...');
  await seedRealRoster();

  console.log('Seeding Milestone 1 demo submissions...');
  await seedDemoSubmissions();

  console.log('Seeding demo department performance snapshots...');
  await seedDepartmentPerformance();

  console.log('Seeding CEO Portal demo data (milestones, weekly reports, memos, appointments)...');
  await seedCeoPortalDemoData();

  console.log('Seed complete.');

  // Real NICTA staff, provided directly by the client (2026-08-21) — see #A20. Directors get both
  // SUBMITTER (the functional role actually checked by submission RBAC, src/lib/auth/rbac.ts —
  // "Director" is SUBMITTER's display name, not the DIRECTOR role code) and DIRECTOR (department
  // read-access/oversight, the pre-existing later-module role code) so they can both submit papers
  // now and aren't blocked out of anything DIRECTOR unlocks later. Corporate Secretariat gets
  // REVIEWER_SECRETARIAT. isDemoUser: false throughout — these are real people, not fixtures.
  async function seedRealRoster() {
    const directors: { email: string; name: string; jobTitle: string; departmentCode: string }[] = [
      {
        email: 'rasari@nicta.gov.pg',
        name: 'Robertson Asari',
        jobTitle: 'Director',
        departmentCode: 'DIGITAL_TRANSFORMATION',
      },
      {
        email: 'sanda@nicta.gov.pg',
        name: 'Steven Anda',
        jobTitle: 'Director',
        departmentCode: 'ENGINEERING',
      },
      {
        email: 'ckerua@nicta.gov.pg',
        name: 'Charles Kerua',
        jobTitle: 'Director',
        departmentCode: 'ECON_LICENSING',
      },
      {
        email: 'plume@nicta.gov.pg',
        name: 'Polume Lume',
        jobTitle: 'Director (Acting Oversight)',
        departmentCode: 'COMPLIANCE',
      },
      {
        email: 'janania@nicta.gov.pg',
        name: 'Jonathan Anania',
        jobTitle: 'Director',
        departmentCode: 'CORPORATE_SERVICES',
      },
    ];
    for (const d of directors) {
      await upsertUser({
        email: d.email,
        name: d.name,
        jobTitle: d.jobTitle,
        departmentCode: d.departmentCode,
        isDemoUser: false,
        roleAssignments: [
          { role: 'SUBMITTER', departmentCode: d.departmentCode },
          { role: 'DIRECTOR', departmentCode: d.departmentCode },
        ],
      });
    }

    const secretariat: { email: string; name: string; jobTitle: string }[] = [
      { email: 'ltol@nicta.gov.pg', name: 'Lilah Tol', jobTitle: 'Corporate Secretary' },
      {
        email: 'bkuman@nicta.gov.pg',
        name: 'Britany Kuman',
        jobTitle: 'Senior Governance Officer',
      },
    ];
    for (const s of secretariat) {
      await upsertUser({
        email: s.email,
        name: s.name,
        jobTitle: s.jobTitle,
        departmentCode: 'CORPORATE_SERVICES',
        isDemoUser: false,
        roleAssignments: [{ role: 'REVIEWER_SECRETARIAT', departmentCode: null }],
      });
    }

    // rasari@nicta.gov.pg existed already (provisioned via the admin UI during earlier testing,
    // in ECON_LICENSING) before this roster moved them to DIGITAL_TRANSFORMATION. upsertUser only
    // adds missing (role, department) UserRole rows, it never removes a now-stale one for a
    // department a person has left — so explicitly drop any SUBMITTER/DIRECTOR assignment these
    // five directors hold for a department other than their roster one, one time, here.
    for (const d of directors) {
      const user = await prisma.user.findUnique({ where: { email: d.email } });
      const correctDeptId = departments.get(d.departmentCode);
      if (!user || !correctDeptId) continue;
      await prisma.userRole.deleteMany({
        where: {
          userId: user.id,
          roleId: { in: [roles.get('SUBMITTER')!, roles.get('DIRECTOR')!] },
          NOT: { departmentId: correctDeptId },
        },
      });
    }

    // Demo personas these real people supersede — deactivated, not deleted, so any demo
    // submissions/audit history they authored stay intact and still visible to reviewers/admins.
    // Skipped in the per-department loop above going forward; this also retires already-seeded
    // rows from before this roster existed. OCEO's demo director is NOT in this list (no real OCEO
    // director was given — the CEO persona covers that department).
    const supersededDemoEmails = [
      'director.econ_licensing.demo@nicta.gov.pg',
      'director.digital_transformation.demo@nicta.gov.pg',
      'director.engineering.demo@nicta.gov.pg',
      'director.compliance.demo@nicta.gov.pg',
      'director.corporate_services.demo@nicta.gov.pg',
      'submitter.demo@nicta.gov.pg', // Rachel Kaupa — the original primary demo Director persona
      'reviewer.demo@nicta.gov.pg', // Thomas Iga — the original demo Corporate Secretary persona
    ];
    await prisma.user.updateMany({
      where: { email: { in: supersededDemoEmails } },
      data: { isActive: false },
    });
  }

  async function seedDemoSubmissions() {
    const econLicensingId = departments.get('ECON_LICENSING')!;
    const twoDigitYear = CURRENT_FY.replace('FY', '').slice(-2);
    const alreadySeeded = await prisma.submission.findFirst({
      where: { referenceNumber: `SMC-${twoDigitYear}-001` },
    });
    if (alreadySeeded) {
      console.log('Demo submissions already present, skipping.');
      return;
    }

    // Matches src/lib/submissions/referenceNumber.ts's format exactly ("SMC-26-001") — see #A17.
    let seq = 0;
    const nextRef = () => {
      seq += 1;
      return `SMC-${twoDigitYear}-${String(seq).padStart(3, '0')}`;
    };
    let boardSeq = 0;
    const nextBoardRef = () => {
      boardSeq += 1;
      return `BP-${twoDigitYear}-${String(boardSeq).padStart(3, '0')}`;
    };

    // 1. Draft — not yet submitted, no document uploaded.
    await prisma.submission.create({
      data: {
        referenceNumber: nextRef(),
        submissionCategory: 'SMC',
        paperType: 'Management Report',
        title: 'Q1 2026 Licensing Compliance Update (DEMO)',
        departmentId: econLicensingId,
        createdById: submitter.id,
        responsibleManagerId: submitter.id,
        meetingId: meeting.id,
        confidentiality: 'INTERNAL',
        purpose: 'Quarterly update on licensing compliance activity for SMC visibility.',
        templateId: templateIds.get('Management Report'),
        workflowStatus: 'DRAFT',
      },
    });

    // 2. Returned for correction — full AI review + secretariat return, awaiting resubmission.
    const returnedRef = nextRef();
    const returned = await prisma.submission.create({
      data: {
        referenceNumber: returnedRef,
        submissionCategory: 'SMC',
        paperType: 'SMC Information Paper',
        title: 'Digital Licensing Portal Rollout — Phase 2 Update (DEMO)',
        departmentId: econLicensingId,
        createdById: submitter.id,
        responsibleManagerId: submitter.id,
        meetingId: meeting.id,
        confidentiality: 'INTERNAL',
        purpose: 'Progress update on Phase 2 of the digital licensing portal rollout.',
        executiveSummary: 'Phase 2 rollout is 60% complete; two regional offices remain.',
        templateId: templateIds.get('SMC Information Paper'),
        mainDocumentStorageKey: `ECON_LICENSING/${CURRENT_FY}/${returnedRef}/01 Main Paper/DEMO_placeholder_no_real_file.docx`,
        mainDocumentFileName: 'digital-licensing-portal-phase2-update.docx',
        currentVersion: 1,
        submittedAt: new Date('2026-03-10T04:00:00Z'),
        workflowStatus: 'RETURNED',
      },
    });
    await prisma.aIReviewResult.create({
      data: {
        submissionId: returned.id,
        templateId: templateIds.get('SMC Information Paper'),
        overallResult: 'PASS_WITH_WARNINGS',
        missingSections: JSON.stringify([]),
        warnings: JSON.stringify([
          'Executive Summary is brief — consider adding regional rollout figures.',
        ]),
        suggestedCorrections: JSON.stringify(['Add a rollout completion percentage per region.']),
        sourceReferences: JSON.stringify(['Purpose / Description', 'Executive Summary']),
        providerMode: 'mock',
        humanReviewStatus: 'ACKNOWLEDGED',
      },
    });
    await prisma.submissionReview.create({
      data: {
        submissionId: returned.id,
        reviewerId: reviewer.id,
        reviewerRole: 'REVIEWER_SECRETARIAT',
        outcome: 'Returned',
        comments: 'Please add per-region completion figures before resubmitting.',
      },
    });
    await recordTransitionChain(returned.id, [
      { from: 'DRAFT', to: 'SUBMITTED', by: submitter.id, comment: 'Submitted by submitter' },
      {
        from: 'SUBMITTED',
        to: 'AI_REVIEWED',
        by: submitter.id,
        comment: 'AI template review complete: PASS_WITH_WARNINGS',
      },
      {
        from: 'AI_REVIEWED',
        to: 'SECRETARIAT_REVIEW',
        by: submitter.id,
        comment: 'Routed to secretariat review queue',
      },
      {
        from: 'SECRETARIAT_REVIEW',
        to: 'RETURNED',
        by: reviewer.id,
        comment: 'Please add per-region completion figures before resubmitting.',
      },
    ]);

    // 3. Accepted, endorsed for Board by SEMC, and the Director's Board Paper already submitted —
    // full lifecycle across both registers (see docs/mvp-directors-portal-plan.md#A18).
    const endorsedRef = nextRef();
    const endorsed = await prisma.submission.create({
      data: {
        referenceNumber: endorsedRef,
        submissionCategory: 'SMC',
        paperType: 'SMC Decision Paper',
        title: 'Spectrum Licensing Fee Adjustment (DEMO)',
        departmentId: econLicensingId,
        createdById: submitter.id,
        responsibleManagerId: submitter.id,
        meetingId: meeting.id,
        confidentiality: 'INTERNAL',
        purpose: 'Proposes an adjustment to spectrum licensing fees for FY2026.',
        executiveSummary:
          'Recommends a 4% fee adjustment to align with updated cost-recovery modelling.',
        recommendation: 'That SMC endorse the proposed spectrum licensing fee adjustment.',
        proposedDecision:
          'SMC approves a 4% increase to spectrum licensing fees effective FY2026 Q3.',
        templateId: templateIds.get('SMC Decision Paper'),
        mainDocumentStorageKey: `ECON_LICENSING/${CURRENT_FY}/${endorsedRef}/01 Main Paper/DEMO_placeholder_no_real_file.docx`,
        mainDocumentFileName: 'spectrum-licensing-fee-adjustment.docx',
        currentVersion: 1,
        submittedAt: new Date('2026-03-05T04:00:00Z'),
        endorsedForBoard: true,
        endorsedForBoardAt: new Date('2026-03-08T05:00:00Z'),
        endorsedForBoardById: reviewer.id,
        workflowStatus: 'ACCEPTED',
      },
    });
    await prisma.aIReviewResult.create({
      data: {
        submissionId: endorsed.id,
        templateId: templateIds.get('SMC Decision Paper'),
        overallResult: 'PASS',
        missingSections: JSON.stringify([]),
        warnings: JSON.stringify([]),
        suggestedCorrections: JSON.stringify([]),
        sourceReferences: JSON.stringify([
          'Purpose / Description',
          'Executive Summary',
          'Recommendation',
          'Proposed Decision',
        ]),
        providerMode: 'mock',
        humanReviewStatus: 'ACKNOWLEDGED',
      },
    });
    await prisma.submissionReview.create({
      data: {
        submissionId: endorsed.id,
        reviewerId: reviewer.id,
        reviewerRole: 'REVIEWER_SECRETARIAT',
        outcome: 'Accepted',
        comments: 'Complete and well-supported. SEMC endorses this for Board consideration.',
      },
    });
    await recordTransitionChain(endorsed.id, [
      { from: 'DRAFT', to: 'SUBMITTED', by: submitter.id, comment: 'Submitted by submitter' },
      {
        from: 'SUBMITTED',
        to: 'AI_REVIEWED',
        by: submitter.id,
        comment: 'AI template review complete: PASS',
      },
      {
        from: 'AI_REVIEWED',
        to: 'SECRETARIAT_REVIEW',
        by: submitter.id,
        comment: 'Routed to secretariat review queue',
      },
      {
        from: 'SECRETARIAT_REVIEW',
        to: 'ACCEPTED',
        by: reviewer.id,
        comment: 'Complete and well-supported. SEMC endorses this for Board consideration.',
      },
    ]);
    await prisma.auditEvent.create({
      data: {
        userId: reviewer.id,
        action: 'SUBMISSION_ENDORSED_FOR_BOARD',
        entityType: 'Submission',
        entityId: endorsed.id,
        newState: JSON.stringify({ endorsedForBoard: true }),
        correlationRef: endorsedRef,
      },
    });

    // The Director's resulting Board Paper — a distinct Submission (category BOARD), per #A18.
    const boardRef = nextBoardRef();
    const boardPaper = await prisma.submission.create({
      data: {
        referenceNumber: boardRef,
        submissionCategory: 'BOARD',
        paperType: endorsed.paperType,
        title: `Board Paper: ${endorsed.title}`,
        departmentId: econLicensingId,
        createdById: submitter.id,
        responsibleManagerId: submitter.id,
        meetingId: meeting.id,
        confidentiality: 'INTERNAL',
        purpose:
          'SEMC endorsed the proposed 4% spectrum licensing fee adjustment on 8 March 2026. The Board is asked to approve the adjustment effective FY2026 Q3, noting SEMC’s support for the updated cost-recovery modelling.',
        templateId: endorsed.templateId,
        smcSourceSubmissionId: endorsed.id,
        mainDocumentStorageKey: `ECON_LICENSING/${CURRENT_FY}/${boardRef}/01 Main Paper/DEMO_placeholder_no_real_file.docx`,
        mainDocumentFileName: 'spectrum-licensing-fee-adjustment-board-paper.docx',
        submittedAt: new Date('2026-03-09T02:00:00Z'),
        workflowStatus: 'SUBMITTED',
      },
    });
    await prisma.auditEvent.create({
      data: {
        userId: submitter.id,
        action: 'BOARD_PAPER_SUBMITTED',
        entityType: 'Submission',
        entityId: boardPaper.id,
        newState: JSON.stringify({ referenceNumber: boardRef, sourceSubmissionId: endorsed.id }),
        correlationRef: boardRef,
      },
    });
    await prisma.actionItem.create({
      data: {
        submissionId: boardPaper.id,
        createdById: ceo.id,
        description:
          'Confirm updated cost-recovery modelling figures with Finance before the Board meeting.',
        status: 'OPEN',
      },
    });

    await prisma.sequenceCounter.upsert({
      where: { scope: REF_SCOPE },
      update: { value: seq },
      create: { scope: REF_SCOPE, value: seq },
    });
    await prisma.sequenceCounter.upsert({
      where: { scope: `BP-${CURRENT_FY.replace('FY', '')}` },
      update: { value: boardSeq },
      create: { scope: `BP-${CURRENT_FY.replace('FY', '')}`, value: boardSeq },
    });
  }

  async function recordTransitionChain(
    submissionId: string,
    chain: { from: string; to: string; by: string; comment: string }[],
  ) {
    for (const step of chain) {
      await prisma.workflowTransition.create({
        data: {
          entityType: 'Submission',
          submissionId,
          fromState: step.from,
          toState: step.to,
          performedById: step.by,
          comment: step.comment,
        },
      });
      await prisma.auditEvent.create({
        data: {
          userId: step.by,
          action: 'SUBMISSION_TRANSITION',
          entityType: 'Submission',
          entityId: submissionId,
          previousState: JSON.stringify({ workflowStatus: step.from }),
          newState: JSON.stringify({ workflowStatus: step.to }),
        },
      });
    }
  }

  // #A31 — demo-only department performance trend (Jan-Jun 2026) backing the CEO Dashboard's
  // KPI/KRA chart and department traffic-light table. Fictional figures, not real NICTA
  // performance data — see the model's own schema comment and docs/known-limitations.md. Six
  // monthly ReportingPeriod rows are created (this codebase previously only had two *quarterly*
  // ones) since the approved CEO mockup shows a monthly Jan-Jun trend line.
  async function seedDepartmentPerformance() {
    const months = [
      {
        code: '2026-01',
        label: 'January 2026',
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
      },
      {
        code: '2026-02',
        label: 'February 2026',
        start: new Date('2026-02-01'),
        end: new Date('2026-02-28'),
      },
      {
        code: '2026-03',
        label: 'March 2026',
        start: new Date('2026-03-01'),
        end: new Date('2026-03-31'),
      },
      {
        code: '2026-04',
        label: 'April 2026',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-30'),
      },
      {
        code: '2026-05',
        label: 'May 2026',
        start: new Date('2026-05-01'),
        end: new Date('2026-05-31'),
      },
      {
        code: '2026-06',
        label: 'June 2026',
        start: new Date('2026-06-01'),
        end: new Date('2026-06-30'),
      },
    ];

    const periodIds: string[] = [];
    for (const m of months) {
      const period = await prisma.reportingPeriod.upsert({
        where: { code: m.code },
        update: { label: m.label },
        create: {
          code: m.code,
          label: m.label,
          periodType: 'Monthly',
          startDate: m.start,
          endDate: m.end,
        },
      });
      periodIds.push(period.id);
    }

    // June (latest) target per department — chosen so the computed traffic-light status (see
    // src/lib/performance/riskService.ts's default thresholds) lands on a mix matching the
    // approved mockup: 3 On Track, 2 At Risk, 1 Critical.
    const departmentTargets: Record<
      string,
      { kpi: number; kra: number; overdue: number; risks: number }
    > = {
      DIGITAL_TRANSFORMATION: { kpi: 85, kra: 79, overdue: 1, risks: 0 },
      ENGINEERING: { kpi: 68, kra: 60, overdue: 4, risks: 1 },
      ECON_LICENSING: { kpi: 78, kra: 74, overdue: 2, risks: 0 },
      COMPLIANCE: { kpi: 48, kra: 42, overdue: 7, risks: 3 },
      CORPORATE_SERVICES: { kpi: 62, kra: 56, overdue: 5, risks: 1 },
      OCEO: { kpi: 90, kra: 86, overdue: 0, risks: 0 },
    };
    // A shared starting point each department ramps up from, over the 6 months — mirrors the
    // approved mockup's org-wide trend line shape (steadily improving, not flat or declining).
    const START_KPI = 55;
    const START_KRA = 42;

    for (const dept of SEED_DEPARTMENTS) {
      const target = departmentTargets[dept.code];
      if (!target) continue;
      const departmentId = departments.get(dept.code);
      if (!departmentId) continue;

      for (let i = 0; i < months.length; i++) {
        const reportingPeriodId = periodIds[i];
        const month = months[i];
        if (!reportingPeriodId || !month) continue;
        const t = i / (months.length - 1);
        const kpiPercent = Math.round(START_KPI + (target.kpi - START_KPI) * t);
        const kraPercent = Math.round(START_KRA + (target.kra - START_KRA) * t);
        const overdueActivities = Math.max(0, Math.round(target.overdue * (0.5 + 0.5 * t)));
        const criticalRisks =
          i === months.length - 1 ? target.risks : Math.max(0, target.risks - 1);

        await prisma.departmentPerformance.upsert({
          where: {
            departmentId_reportingPeriodId: {
              departmentId,
              reportingPeriodId,
            },
          },
          update: { kpiPercent, kraPercent, overdueActivities, criticalRisks },
          create: {
            departmentId,
            reportingPeriodId,
            kpiPercent,
            kraPercent,
            overdueActivities,
            criticalRisks,
            lastReportedAt: month.end,
          },
        });
      }
    }
  }

  // #A32 — demo data for the CEO Portal's new modules: Milestones, Weekly Manager Reports,
  // Director Summaries, Memos, financial routing config, and Appointments. Fictional, clearly
  // demo-labelled where user-visible (isDemoUser), idempotent (guarded by natural keys / existing
  // rows), so re-running `db:seed` never duplicates.
  async function seedCeoPortalDemoData() {
    await upsertUser({
      email: 'ceo.office.demo@nicta.gov.pg',
      name: 'Dorothy Kaupa (Demo Executive Officer)',
      jobTitle: 'Executive Officer to the CEO',
      departmentCode: 'OCEO',
      roleAssignments: [{ role: 'CEO_OFFICE', departmentCode: null }],
    });

    const financialRuleSeeds = [
      { label: 'Up to K50,000', minAmount: 0, maxAmount: 50000, stages: ['SUBMITTER'] },
      {
        label: 'Above K50,000 up to K1,000,000',
        minAmount: 50000.01,
        maxAmount: 1000000,
        stages: ['SUBMITTER', 'EXECUTIVE_VIEWER'],
      },
      {
        label: 'Above K1,000,000',
        minAmount: 1000000.01,
        maxAmount: null,
        stages: ['SUBMITTER', 'EXECUTIVE_VIEWER', 'BOARD_SECRETARIAT'],
      },
    ];
    for (const rule of financialRuleSeeds) {
      const existing = await prisma.financialApprovalRule.findFirst({ where: { label: rule.label } });
      if (!existing) {
        await prisma.financialApprovalRule.create({
          data: {
            label: rule.label,
            minAmount: rule.minAmount,
            maxAmount: rule.maxAmount,
            approvalStageSequence: JSON.stringify(rule.stages),
          },
        });
      }
    }

    const directors = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { code: 'SUBMITTER' } } } },
      include: { department: true },
      orderBy: { name: 'asc' },
    });
    const managers = await prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { code: 'MANAGER' } } } },
      include: { department: true },
      orderBy: { name: 'asc' },
    });
    const ceoUser = await prisma.user.findFirst({
      where: { isActive: true, roles: { some: { role: { code: 'EXECUTIVE_VIEWER' } } } },
    });

    // Milestones — one per real Director, deliberately spanning On Track / At Risk / overdue-
    // Critical so the traffic-light computation (riskService.ts) shows a real mix.
    const milestoneSeeds = [
      { title: 'Cyber Security Bill consultation', target: 'Complete stakeholder consultation and table the draft Bill', progress: 65, dueInDays: 7 },
      { title: 'Spectrum licensing modernisation', target: 'Migrate the licensing register to the new platform', progress: 90, dueInDays: 5 },
      { title: 'Enforcement case backlog reduction', target: 'Clear 80% of the current enforcement case backlog', progress: 35, dueInDays: -3 },
      { title: 'Corporate Plan KPI refresh', target: 'Publish the refreshed 2027-2029 Corporate Plan KPI set', progress: 55, dueInDays: 14 },
    ];
    for (let i = 0; i < milestoneSeeds.length; i++) {
      const seedItem = milestoneSeeds[i];
      const director = directors[i % directors.length];
      if (!seedItem || !director || !director.departmentId) continue;
      const existing = await prisma.milestone.findFirst({ where: { title: seedItem.title } });
      if (existing) continue;
      await prisma.milestone.create({
        data: {
          referenceNumber: `MS-DEMO-${String(i + 1).padStart(3, '0')}`,
          title: seedItem.title,
          targetDescription: seedItem.target,
          departmentId: director.departmentId,
          responsibleDirectorId: director.id,
          dueDate: new Date(Date.now() + seedItem.dueInDays * 24 * 60 * 60 * 1000),
          progressPercent: seedItem.progress,
          validationStatus: i === 0 ? 'AWAITING_CEO_VALIDATION' : 'SUBMITTED',
          createdById: ceoUser?.id ?? director.id,
        },
      });
    }

    // Weekly Manager Reports — this week, a mix of on-time/late/not-yet-submitted per manager, so
    // the CEO's departmental compliance summary shows real variation.
    const week = getReportingWeekFor();
    const weekPeriod = await prisma.reportingPeriod.upsert({
      where: { code: week.code },
      update: {},
      create: {
        code: week.code,
        label: week.label,
        periodType: 'Weekly',
        startDate: week.weekStart,
        endDate: week.weekEnd,
      },
    });
    for (let i = 0; i < managers.length; i++) {
      const manager = managers[i];
      if (!manager || !manager.departmentId) continue;
      if (i % 3 === 2) continue; // leave roughly a third un-submitted, so "late/missing" is real
      const existing = await prisma.weeklyManagerReport.findFirst({
        where: { managerId: manager.id, reportingPeriodId: weekPeriod.id },
      });
      if (existing) continue;
      const isLate = i % 4 === 0;
      await prisma.weeklyManagerReport.create({
        data: {
          referenceNumber: `WR-DEMO-${week.code}-${String(i + 1).padStart(3, '0')}`,
          reportingPeriodId: weekPeriod.id,
          departmentId: manager.departmentId,
          managerId: manager.id,
          category: i % 2 === 0 ? 'BAU' : 'Project',
          progressPercent: 40 + ((i * 13) % 55),
          workCompleted: 'Progressed weekly workplan activities and cleared outstanding correspondence.',
          plannedWork: 'Continue scheduled activities for next week.',
          isLate,
          lateJustification: isLate ? 'Delayed by a departmental all-staff meeting.' : null,
          status: isLate ? 'LATE' : 'SUBMITTED',
        },
      });
    }

    // Director Summaries — one per department for this week, some validated, one awaiting.
    for (const dept of SEED_DEPARTMENTS) {
      const departmentId = departments.get(dept.code);
      const director = directors.find((d) => d.departmentId === departmentId);
      if (!departmentId || !director) continue;
      const existing = await prisma.directorSummary.findFirst({
        where: { departmentId, reportingPeriodId: weekPeriod.id },
      });
      if (existing) continue;
      await prisma.directorSummary.create({
        data: {
          departmentId,
          directorId: director.id,
          reportingPeriodId: weekPeriod.id,
          keyAchievements: `${dept.name} delivered its scheduled workplan milestones this week.`,
          kpiKraProgressNote: 'On track against quarterly KPI/KRA targets.',
          criticalActivities: 'No critical activities outstanding.',
          decisionsRequired: dept.code === 'COMPLIANCE' ? 'Resourcing decision needed for the enforcement backlog.' : null,
          nextPeriodPriorities: 'Continue current workplan activities.',
          lastReportingDate: new Date(),
          ceoValidationStatus: dept.code === 'COMPLIANCE' ? 'SUBMITTED' : 'VALIDATED',
          createdById: director.id,
        },
      });
    }

    // Memos & BAU Approvals — a spread across categories/statuses, including one financial
    // memo above K50,000 (routes to CEO per financialRouting.ts) and one plain BAU item
    // (WhatsApp-eligible, per memos/categories.ts).
    const memoSeeds = [
      { category: 'Financial Delegation', subject: 'Network hardware procurement', financialValue: 85000, status: 'AWAITING_CEO_APPROVAL' as const },
      { category: 'General BAU Approval', subject: 'Staff travel request', financialValue: null, status: 'AWAITING_CEO_APPROVAL' as const },
      { category: 'Administrative Memo', subject: 'Office maintenance', financialValue: null, status: 'DRAFT' as const },
    ];
    for (let i = 0; i < memoSeeds.length; i++) {
      const seedItem = memoSeeds[i];
      const director = directors[i % directors.length];
      if (!seedItem || !director || !director.departmentId) continue;
      const existing = await prisma.memo.findFirst({ where: { subject: seedItem.subject } });
      if (existing) continue;
      await prisma.memo.create({
        data: {
          referenceNumber: `MEMO-DEMO-${String(i + 1).padStart(3, '0')}`,
          category: seedItem.category,
          subject: seedItem.subject,
          originatingDirectorId: director.id,
          departmentId: director.departmentId,
          purpose: `${seedItem.subject} — demo memo for CEO Portal review.`,
          requestedDecision: 'Approve as recommended.',
          recommendation: 'Recommended for approval.',
          financialValue: seedItem.financialValue,
          budgetCode: seedItem.financialValue ? 'ICT-CAPEX-2026' : null,
          costCentre: seedItem.financialValue ? 'CCS-IT-INFRA' : null,
          priority: 'MEDIUM',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          status: seedItem.status,
          createdById: director.id,
        },
      });
    }

    // Appointments — one upcoming, one already-responded, so the CEO screens show real invitee
    // response variation.
    if (ceoUser && directors.length > 0) {
      const existing = await prisma.appointment.findFirst({ where: { title: 'SEMC Preparatory Briefing' } });
      if (!existing) {
        const appointment = await prisma.appointment.create({
          data: {
            title: 'SEMC Preparatory Briefing',
            agenda: 'Walk through the agenda ahead of the next SEMC meeting.',
            startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            endAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            location: 'Boardroom A / Microsoft Teams',
            organiserId: ceoUser.id,
          },
        });
        for (const director of directors.slice(0, 3)) {
          await prisma.appointmentInvitee.create({
            data: { appointmentId: appointment.id, userId: director.id },
          });
        }
      }
    }
  }

  async function upsertUser(input: {
    email: string;
    name: string;
    jobTitle: string;
    departmentCode: string | null;
    roleAssignments: { role: RoleCode; departmentCode: string | null }[];
    isDemoUser?: boolean; // defaults true — real roster entries (see seedRealRoster) pass false
  }) {
    const isDemoUser = input.isDemoUser ?? true;
    const departmentId = input.departmentCode
      ? (departments.get(input.departmentCode) ?? null)
      : null;
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: { name: input.name, jobTitle: input.jobTitle, departmentId, isDemoUser },
      create: {
        email: input.email,
        name: input.name,
        jobTitle: input.jobTitle,
        departmentId,
        isDemoUser,
      },
    });

    for (const assignment of input.roleAssignments) {
      const roleId = roles.get(assignment.role);
      if (!roleId) throw new Error(`Unknown role code ${assignment.role}`);
      const assignmentDepartmentId = assignment.departmentCode
        ? (departments.get(assignment.departmentCode) ?? null)
        : null;
      const existing = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId, departmentId: assignmentDepartmentId },
      });
      if (!existing) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId, departmentId: assignmentDepartmentId },
        });
      }
    }
    return user;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
