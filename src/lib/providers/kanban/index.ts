import { getEnv } from '@/lib/config/env';
import { DatabaseKanbanRepository } from '@/lib/providers/kanban/databaseProvider';
import { MicrosoftListsKanbanRepository } from '@/lib/providers/kanban/microsoftListsProvider';
import type { KanbanRepository } from '@/lib/providers/kanban/interface';

let provider: KanbanRepository | undefined;

export function getKanbanRepository(): KanbanRepository {
  if (provider) return provider;
  const env = getEnv();
  provider =
    env.KANBAN_PROVIDER === 'microsoft-lists'
      ? new MicrosoftListsKanbanRepository()
      : new DatabaseKanbanRepository();
  return provider;
}

export type { KanbanRepository, KanbanCard } from '@/lib/providers/kanban/interface';
