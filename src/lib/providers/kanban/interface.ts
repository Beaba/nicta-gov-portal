import type { ActivityPriority, KanbanStage } from '@prisma/client';

// The board-card projection every Kanban surface (department board, my-activities board) renders
// from, independent of where the underlying data actually lives. See
// docs/assumptions-and-decisions.md#A7 for why stage/priority are fixed enums rather than
// admin-configurable reference data while Department/Role are not (#A5 covers the enum choice).
export interface KanbanCard {
  activityId: string;
  workplanId: string;
  referenceNumber: string;
  title: string;
  stage: KanbanStage;
  priority: ActivityPriority;
  responsibleOfficerId: string | null;
  dueDate: Date | null;
  percentComplete: number;
}

export interface KanbanRepository {
  readonly providerName: 'database' | 'microsoft-lists';
  /** All cards for a workplan, grouped by the caller into columns using `stage`. */
  listBoard(workplanId: string): Promise<KanbanCard[]>;
  /**
   * Persists a stage change for one card. Callers are responsible for permission checks and for
   * recording the WorkflowTransition/audit trail (src/lib/workflow/kanbanTransitions.ts) — this
   * method only owns "where the board data is written."
   */
  moveStage(activityId: string, toStage: KanbanStage): Promise<KanbanCard>;
}
