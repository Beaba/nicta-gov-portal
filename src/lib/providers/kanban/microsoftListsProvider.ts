import type { KanbanStage } from '@prisma/client';
import type { KanbanRepository, KanbanCard } from '@/lib/providers/kanban/interface';
import { getEnv } from '@/lib/config/env';

// Section 6's canonical target ("Microsoft Lists ... as the primary data source for Kanban
// tracking"), not implemented against a live tenant in this build — see
// docs/assumptions-and-decisions.md#A7 for why the database provider is authoritative for the
// MVP. Documents the intended Graph shape for whoever wires this up:
//
//   listBoard  -> GET /sites/{SHAREPOINT_SITE_ID}/lists/{MICROSOFT_LISTS_ACTIVITY_LIST_ID}/items
//                 ?expand=fields&$filter=fields/WorkplanId eq '{workplanId}'
//                 mapping each item's `fields` to a KanbanCard (Title, Stage (choice column),
//                 Priority, ResponsibleOfficerId, DueDate, PercentComplete).
//   moveStage  -> PATCH /sites/{siteId}/lists/{listId}/items/{itemId}/fields
//                 body: { Stage: toStage }
//
// A production cutover would also need a one-time backfill of existing Activity rows into the
// list and a decision on which store stays authoritative during migration — see
// docs/known-limitations.md.
export class MicrosoftListsKanbanRepository implements KanbanRepository {
  readonly providerName = 'microsoft-lists' as const;

  private assertConfigured(): void {
    const env = getEnv();
    if (!env.SHAREPOINT_SITE_ID || !env.MICROSOFT_LISTS_ACTIVITY_LIST_ID) {
      throw new Error(
        'KANBAN_PROVIDER=microsoft-lists requires SHAREPOINT_SITE_ID and ' +
          'MICROSOFT_LISTS_ACTIVITY_LIST_ID. See docs/sharepoint-provisioning-guide.md.',
      );
    }
  }

  async listBoard(_workplanId: string): Promise<KanbanCard[]> {
    this.assertConfigured();
    throw new Error(
      'MicrosoftListsKanbanRepository is not implemented against a live tenant in this build.',
    );
  }

  async moveStage(_activityId: string, _toStage: KanbanStage): Promise<KanbanCard> {
    this.assertConfigured();
    throw new Error(
      'MicrosoftListsKanbanRepository is not implemented against a live tenant in this build.',
    );
  }
}
