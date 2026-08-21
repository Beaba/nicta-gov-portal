// `type` is a free-form code (e.g. "DEADLINE_REMINDER", "SUBMISSION_RETURNED",
// "ACTIVITY_UPDATE_REVIEWED") rather than an enum so new notification triggers can be added
// without a migration — mirrors Notification.type in prisma/schema.prisma.
export interface NotificationInput {
  userId: string;
  type: string;
  message: string;
  linkUrl?: string;
}

export interface NotificationProvider {
  readonly providerName: 'mock' | 'graph';
  notify(input: NotificationInput): Promise<void>;
}
