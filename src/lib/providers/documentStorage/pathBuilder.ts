import path from 'node:path';
import { DateTime } from 'luxon';
import { getEnv } from '@/lib/config/env';
import type { DocumentPlacementMetadata } from '@/lib/providers/documentStorage/interface';

// Single source of truth for the NICTA Governance Portal folder hierarchy — both
// LocalDocumentStorageProvider and SharePointDocumentStorageProvider call buildDocumentPathSegments
// so the two providers can never drift out of sync on "where does this file go." This module is
// pure and synchronous (no DB/network access) so it's safe to call from describeDestination.
const TEMPLATES_LIBRARY = 'Approved NICTA Templates';
const GOVERNANCE_LIBRARY = 'Governance Papers';

/** "Digital Economy Update" -> "Digital-Economy-Update": trim, collapse runs of whitespace/
 * non-alphanumeric characters into a single hyphen, strip leading/trailing hyphens. */
export function slugifyTitle(title: string): string {
  return title
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 0 -> "A", 1 -> "B", ..., 25 -> "Z", 26 -> "AA", ... (Excel-column style) so annexure lettering
 * never runs out, however unlikely more than 26 annexures on one submission is in practice. */
export function annexureLetter(order: number): string {
  let n = order;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function departmentFolderName(departmentName: string): string {
  return departmentName.trim().replace(/\s+/g, '_');
}

function extensionOf(fileName: string): string {
  return path.extname(fileName);
}

/** Formats a Meeting.meetingDate (passed through as an ISO string) into the {year} and
 * {meetingDate:YYYY-MM-DD} folder segments, interpreted in the app's configured timezone
 * (Pacific/Port_Moresby by default) per this codebase's "deadline/date logic is timezone-aware,
 * never client-local" convention — see CLAUDE.md. */
function meetingDateParts(meetingDateIso: string): { year: string; compact: string } {
  const zone = getEnv().DEFAULT_TIMEZONE;
  let dt = DateTime.fromISO(meetingDateIso, { zone });
  if (!dt.isValid) {
    // Defensive only — every call site is expected to always pass a valid ISO string (falling
    // back to submission.createdAt.toISOString() when no meeting is linked yet, see the TODOs at
    // each call site). buildDocumentPathSegments must stay total rather than throw on a bad date.
    dt = DateTime.now().setZone(zone);
  }
  return { year: String(dt.year), compact: dt.toFormat('yyyy-LL-dd') };
}

/** The client's file-naming requirement: "documents are named based on the Department Name, SMC
 * Date, SMC Board Sitting number" — folded into the destination *file* name (the folder path
 * already encodes department/date separately; this is about what the .docx/.pdf itself is called
 * once someone has downloaded it out of its folder). Format:
 * "{DepartmentFolder}_{YYYY-MM-DD}_{MeetingNumber}_{ReferenceNumber}_{TitleSlug}{ext}". */
function documentFileNamePrefix(
  departmentName: string,
  meetingDateCompact: string,
  meetingNumber: string,
): string {
  return `${departmentFolderName(departmentName)}_${meetingDateCompact}_${meetingNumber}`;
}

function requireField<K extends keyof DocumentPlacementMetadata>(
  placement: DocumentPlacementMetadata,
  key: K,
): NonNullable<DocumentPlacementMetadata[K]> {
  const value = placement[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `DocumentPlacementMetadata.${String(key)} is required for kind "${placement.kind}"`,
    );
  }
  return value as NonNullable<DocumentPlacementMetadata[K]>;
}

/**
 * Computes the full folder path (including the destination file name as the final segment) for a
 * placement, per the client's exact NICTA Governance Portal hierarchy:
 *
 *   Approved NICTA Templates/{01_SMC_Templates|02_Board_Templates}/{fileName}
 *   Governance Papers/01_SMC_Submissions/{year}/SMC_{meetingDate}/{01_On_Time|02_Late_Submissions}/
 *     {DepartmentFolder}/{ReferenceNumber}_{TitleSlug}/{01_Submitted_Paper|02_Annexures|03_Reviewed_Output}/...
 *   Governance Papers/02_Board_Papers/{year}/BOARD_{meetingDate}/01_Vetted_for_Board/
 *     {BoardReferenceNumber}_{TitleSlug}/{01_Board_Paper|02_Annexures|03_SMC_Source}/...
 *
 * Returns path segments (not yet joined) so callers can pick their own separator — POSIX '/' for
 * a SharePoint-style logical path, or path.sep for a real filesystem path.
 */
export function buildDocumentPathSegments(placement: DocumentPlacementMetadata): string[] {
  const fileName = requireField(placement, 'fileName');
  const ext = extensionOf(fileName);

  switch (placement.kind) {
    case 'TEMPLATE': {
      const sub =
        placement.templateCategory === 'BOARD' ? '02_Board_Templates' : '01_SMC_Templates';
      return [TEMPLATES_LIBRARY, sub, fileName];
    }

    case 'SMC_MAIN':
    case 'SMC_ANNEXURE':
    case 'SMC_REVIEWED_OUTPUT': {
      const referenceNumber = requireField(placement, 'referenceNumber');
      const title = requireField(placement, 'title');
      const departmentName = requireField(placement, 'departmentName');
      const meetingDate = requireField(placement, 'meetingDate');
      const meetingNumber = requireField(placement, 'meetingNumber');
      const { year, compact } = meetingDateParts(meetingDate);
      const namePrefix = documentFileNamePrefix(departmentName, compact, meetingNumber);
      const base = [
        GOVERNANCE_LIBRARY,
        '01_SMC_Submissions',
        year,
        `SMC_${compact}`,
        placement.isLate ? '02_Late_Submissions' : '01_On_Time',
        departmentFolderName(departmentName),
        `${referenceNumber}_${slugifyTitle(title)}`,
      ];

      if (placement.kind === 'SMC_MAIN') {
        return [
          ...base,
          '01_Submitted_Paper',
          `${namePrefix}_${referenceNumber}_${slugifyTitle(title)}${ext}`,
        ];
      }
      if (placement.kind === 'SMC_ANNEXURE') {
        const annexureOrder = requireField(placement, 'annexureOrder');
        return [
          ...base,
          '02_Annexures',
          `${namePrefix}_${referenceNumber}_ANNEX-${annexureLetter(annexureOrder)}${ext}`,
        ];
      }
      return [...base, '03_Reviewed_Output', `${namePrefix}_${referenceNumber}_Reviewed${ext}`];
    }

    case 'BOARD_MAIN':
    case 'BOARD_ANNEXURE':
    case 'BOARD_SMC_SOURCE': {
      const referenceNumber = requireField(placement, 'referenceNumber');
      const title = requireField(placement, 'title');
      const meetingDate = requireField(placement, 'meetingDate');
      const { year, compact } = meetingDateParts(meetingDate);
      const base = [
        GOVERNANCE_LIBRARY,
        '02_Board_Papers',
        year,
        `BOARD_${compact}`,
        '01_Vetted_for_Board',
        `${referenceNumber}_${slugifyTitle(title)}`,
      ];

      if (placement.kind === 'BOARD_MAIN' || placement.kind === 'BOARD_ANNEXURE') {
        // Same client naming requirement as SMC_* above ("Department Name, SMC Date, Sitting
        // number"), using the Board Paper's own department/meeting (inherited from its SMC
        // source — see docs/known-limitations.md on Board Papers currently sharing the SMC
        // meeting rather than a distinct Board meeting).
        const departmentName = requireField(placement, 'departmentName');
        const meetingNumber = requireField(placement, 'meetingNumber');
        const namePrefix = documentFileNamePrefix(departmentName, compact, meetingNumber);
        if (placement.kind === 'BOARD_MAIN') {
          return [
            ...base,
            '01_Board_Paper',
            `${namePrefix}_${referenceNumber}_${slugifyTitle(title)}${ext}`,
          ];
        }
        const annexureOrder = requireField(placement, 'annexureOrder');
        return [
          ...base,
          '02_Annexures',
          `${namePrefix}_${referenceNumber}_ANNEX-${annexureLetter(annexureOrder)}${ext}`,
        ];
      }
      // BOARD_SMC_SOURCE: fixed file name (e.g. "Source-Reference.txt"), used verbatim.
      return [...base, '03_SMC_Source', fileName];
    }

    case 'BOARD_MINUTES': {
      const meetingDate = requireField(placement, 'meetingDate');
      const meetingNumber = requireField(placement, 'meetingNumber');
      const version = placement.version ?? 1;
      const { year, compact } = meetingDateParts(meetingDate);
      return [
        GOVERNANCE_LIBRARY,
        '02_Board_Papers',
        year,
        `BOARD_${compact}`,
        '02_Minutes',
        `${meetingNumber}_${compact}_Minutes_v${version}${ext}`,
      ];
    }

    default: {
      const exhaustive: never = placement.kind;
      throw new Error(`Unknown DocumentPlacementMetadata.kind: ${String(exhaustive)}`);
    }
  }
}

/** Joins buildDocumentPathSegments with '/' — the logical path shown by describeDestination in
 * both providers, and the local provider's storageKey. */
export function buildDestinationPath(placement: DocumentPlacementMetadata): string {
  return buildDocumentPathSegments(placement).join('/');
}
