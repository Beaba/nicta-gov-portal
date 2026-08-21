import { prisma } from '@/lib/db/prisma';

// Format matches the client's approved reference design exactly: "SMC-26-042" (2-digit year,
// 3-digit sequence), not the earlier "SMC-2026-0001" guess — see
// docs/assumptions-and-decisions.md#A17. Still centralised here so the pattern can change without
// touching any call site. `category` is a plain string, not the SubmissionCategory enum, so the
// same allocator also backs Board Paper references ("BP-26-020"), which are a different sequence
// scope entirely (see submitBoardPaper in src/lib/submissions/review.ts). Allocation is a single
// atomic upsert (INSERT ... ON CONFLICT DO UPDATE) against SequenceCounter, not COUNT(*) + 1, so
// two concurrent allocations in the same scope never collide — see #A14.
function formatReferenceNumber(category: string, year: string, sequence: number): string {
  const twoDigitYear = year.slice(-2);
  return `${category}-${twoDigitYear}-${String(sequence).padStart(3, '0')}`;
}

export async function nextReferenceNumber(category: string, year: string): Promise<string> {
  const scope = `${category}-${year}`;
  const counter = await prisma.sequenceCounter.upsert({
    where: { scope },
    update: { value: { increment: 1 } },
    create: { scope, value: 1 },
  });
  return formatReferenceNumber(category, year, counter.value);
}
