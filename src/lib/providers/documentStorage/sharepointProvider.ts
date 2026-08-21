import type {
  DocumentStorageProvider,
  DocumentPlacementMetadata,
  StoredDocumentMetadata,
} from '@/lib/providers/documentStorage/interface';
import { getEnv } from '@/lib/config/env';
import { buildDocumentPathSegments } from '@/lib/providers/documentStorage/pathBuilder';

// Production target — the "NICTA Governance Portal" SharePoint site. Not implemented against a
// real tenant (none is available in this environment) — throws with a pointer to the provisioning
// docs if actually invoked, so a misconfigured deployment fails loudly instead of silently
// no-op'ing. The site is expected to hold two document libraries plus one list:
//
//   Approved NICTA Templates [Document Library]
//     01_SMC_Templates/    (SMC_Decision_Paper.docx, SMC_Information_Paper.docx, SMC_Management_Report.docx)
//     02_Board_Templates/  (Board_Decision_Paper.docx, Board_Information_Paper.docx)
//
//   Governance Papers [Document Library]
//     01_SMC_Submissions/{year}/SMC_{meetingDate:YYYY-MM-DD}/{01_On_Time|02_Late_Submissions}/
//       {DepartmentFolder}/{ReferenceNumber}_{TitleSlug}/
//         01_Submitted_Paper/{ReferenceNumber}_{TitleSlug}.docx
//         02_Annexures/{ReferenceNumber}_ANNEX-A.pdf, ...
//         03_Reviewed_Output/{ReferenceNumber}_Reviewed.docx
//     02_Board_Papers/{year}/BOARD_{meetingDate:YYYY-MM-DD}/01_Vetted_for_Board/
//       {BoardReferenceNumber}_{TitleSlug}/
//         01_Board_Paper/{BoardReferenceNumber}_{TitleSlug}.docx
//         02_Annexures/{BoardReferenceNumber}_ANNEX-A.pdf, ...
//         03_SMC_Source/Source-Reference.txt
//
//   Portal Submissions Register [SharePoint List] — already covered by this app's own DB; no
//     action needed here.
//
// buildDocumentPathSegments() in pathBuilder.ts computes the library-relative path shown above
// (e.g. "Governance Papers/01_SMC_Submissions/2026/SMC_2026-03-15/01_On_Time/
// Digital_Transformation_Department/SMC-26-042_Digital-Economy-Update/01_Submitted_Paper/
// SMC-26-042_Digital-Economy-Update.docx") — the exact same logic LocalDocumentStorageProvider
// uses, so the two providers never disagree on where a file belongs. For whoever wires this up
// against a real tenant, the intended Microsoft Graph calls are:
//
//   upload            -> PUT /sites/{SHAREPOINT_SITE_ID}/drives/{SHAREPOINT_DRIVE_ID}/root:/{libraryRelativePath}:/content
//                         (or an upload session for files > 4MB), where {libraryRelativePath} is
//                         buildDocumentPathSegments(placement).join('/') joined onto the drive
//                         root that maps to the relevant document library (Approved NICTA
//                         Templates vs Governance Papers — two separate drives/libraries, so the
//                         caller picks SHAREPOINT_DRIVE_ID accordingly, or this provider resolves
//                         it from placement.kind once a second drive ID env var exists).
//   getDownloadUrl    -> GET .../items/{itemId} and return `@microsoft.graph.downloadUrl`
//                         (a short-lived pre-authenticated URL), or a proxying app route if the
//                         link must stay behind this app's own access control.
//   delete            -> DELETE /sites/{id}/drives/{driveId}/items/{itemId}
export class SharePointDocumentStorageProvider implements DocumentStorageProvider {
  readonly providerName = 'sharepoint' as const;

  private assertConfigured(): void {
    const env = getEnv();
    if (!env.SHAREPOINT_SITE_ID || !env.SHAREPOINT_DRIVE_ID || !env.GRAPH_CLIENT_ID) {
      throw new Error(
        'DOCUMENT_STORAGE_PROVIDER=sharepoint requires SHAREPOINT_SITE_ID, SHAREPOINT_DRIVE_ID and ' +
          'GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/GRAPH_TENANT_ID. See docs/sharepoint-provisioning-guide.md ' +
          'and docs/graph-permissions-guide.md.',
      );
    }
  }

  async upload(_input: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    placement: DocumentPlacementMetadata;
  }): Promise<StoredDocumentMetadata> {
    this.assertConfigured();
    throw new Error(
      'SharePointDocumentStorageProvider is not implemented against a live tenant in this build.',
    );
  }

  async getDownloadUrl(_storageKey: string): Promise<string> {
    this.assertConfigured();
    throw new Error(
      'SharePointDocumentStorageProvider is not implemented against a live tenant in this build.',
    );
  }

  async delete(_storageKey: string): Promise<void> {
    this.assertConfigured();
    throw new Error(
      'SharePointDocumentStorageProvider is not implemented against a live tenant in this build.',
    );
  }

  // Pure path computation, per the client's exact hierarchy documented above — no live call, so a
  // reviewer can see and confirm the intended SharePoint destination even before a tenant is
  // provisioned. Shares buildDocumentPathSegments with LocalDocumentStorageProvider so the two
  // providers always compute the SAME logical path.
  describeDestination(placement: DocumentPlacementMetadata): string {
    return buildDocumentPathSegments(placement).join('/');
  }
}
