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
