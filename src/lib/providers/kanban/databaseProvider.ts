import { prisma } from '@/lib/db/prisma';
import type { KanbanRepository, KanbanCard } from '@/lib/providers/kanban/interface';
import type { Activity, KanbanStage } from '@prisma/client';

function toCard(activity: Activity): KanbanCard {
  return {
    activityId: activity.id,
    workplanId: activity.workplanId,
    referenceNumber: activity.referenceNumber,
    title: activity.title,
    stage: activity.status,
    priority: activity.priority,
    responsibleOfficerId: activity.responsibleOfficerId,
    dueDate: activity.dueDate,
    percentComplete: activity.percentComplete,
  };
}

// MVP source of truth per docs/assumptions-and-decisions.md#A7: reads/writes the application's
// own Activity table directly. Nothing else in the app should query prisma.activity for board
// rendering — go through this repository so a future MicrosoftListsKanbanRepository swap is real.
export class DatabaseKanbanRepository implements KanbanRepository {
  readonly providerName = 'database' as const;

  async listBoard(workplanId: string): Promise<KanbanCard[]> {
    const activities = await prisma.activity.findMany({
      where: { workplanId },
      orderBy: { createdAt: 'asc' },
    });
    return activities.map(toCard);
  }

  async moveStage(activityId: string, toStage: KanbanStage): Promise<KanbanCard> {
    const updated = await prisma.activity.update({
      where: { id: activityId },
      data: { status: toStage },
    });
    return toCard(updated);
  }
}
