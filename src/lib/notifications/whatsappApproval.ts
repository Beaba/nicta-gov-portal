import { prisma } from '@/lib/db/prisma';
import { randomBytes } from 'node:crypto';
import { requireAnyRole } from '@/lib/auth/rbac';
import { isCategoryWhatsAppEligible } from '@/lib/memos/categories';
import { getEnv } from '@/lib/config/env';
import type { AuthenticatedUser } from '@/lib/auth/types';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export class WhatsAppApprovalError extends Error {}

/**
 * #A32 — WhatsApp approval scaffolding only. This deliberately stops short of a working
 * inbound-command loop: there is no live WhatsApp Business API credential in this environment and
 * (correctly) no public webhook route in this codebase that could receive an unauthenticated
 * "APPROVE"/"REJECT" message from the internet. Building that endpoint without real phone-number
 * verification would be the exact "fake it until it looks like it worked" the client's spec
 * explicitly prohibits for approvals. What this module *does* provide, matching the client's
 * required security properties structurally: an expiring, single-use, version-pinned token
 * (`WhatsAppApprovalToken`) any real inbound-command handler would need to validate against —
 * `confirmToken` demonstrates and unit-tests that validation logic (expiry, replay, version
 * mismatch, ambiguous-phrase rejection) even though nothing calls `issueToken` from a live
 * WhatsApp send yet (`WhatsAppNotificationProvider.notify` still throws without credentials — see
 * whatsappProvider.ts). See docs/known-limitations.md.
 */
const TOKEN_TTL_MINUTES = 30;
const VALID_COMMANDS = ['APPROVE', 'REJECT', 'COMMENT', 'REVIEW', 'MORE INFORMATION'] as const;
export type WhatsAppCommand = (typeof VALID_COMMANDS)[number];

export function isRecognisedCommand(raw: string): raw is WhatsAppCommand {
  const normalised = raw.trim().toUpperCase();
  return (VALID_COMMANDS as readonly string[]).includes(normalised);
}

export function isMemoEligibleForWhatsApp(memo: { category: string; financialValue: unknown }): boolean {
  const amount = memo.financialValue ? Number(memo.financialValue) : 0;
  return isCategoryWhatsAppEligible(memo.category) && amount <= 50000;
}

export async function issueWhatsAppApprovalToken(
  memoId: string,
  actingUser: AuthenticatedUser,
  phoneNumberSnapshot?: string,
) {
  requireAnyRole(actingUser, CEO_ROLES);
  const memo = await prisma.memo.findUniqueOrThrow({ where: { id: memoId } });
  if (!isMemoEligibleForWhatsApp(memo)) {
    throw new WhatsAppApprovalError(
      'This item is not eligible for WhatsApp approval — portal-only approval is required.',
    );
  }

  const env = getEnv();
  if (env.NOTIFICATION_PROVIDER !== 'whatsapp' || !env.WHATSAPP_BUSINESS_API_TOKEN) {
    throw new WhatsAppApprovalError(
      'WhatsApp approvals require NOTIFICATION_PROVIDER=whatsapp with live Business API credentials — not configured.',
    );
  }

  const token = randomBytes(16).toString('hex');
  return prisma.whatsAppApprovalToken.create({
    data: {
      memoId,
      token,
      documentVersion: memo.currentVersion,
      phoneNumberSnapshot,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });
}

/** Validates (without ever auto-approving) a WhatsApp reply against replay/expiry/version/command
 * rules. Never treats casual phrases ("Okay", "Looks good") as approval — only an exact match
 * against VALID_COMMANDS is accepted. */
export async function confirmWhatsAppApproval(
  token: string,
  rawCommand: string,
): Promise<{ command: WhatsAppCommand; memoId: string }> {
  const record = await prisma.whatsAppApprovalToken.findUnique({ where: { token }, include: { memo: true } });
  if (!record) throw new WhatsAppApprovalError('Unrecognised or expired approval link.');
  if (record.usedAt) throw new WhatsAppApprovalError('This approval link has already been used.');
  if (record.expiresAt < new Date()) throw new WhatsAppApprovalError('This approval link has expired.');
  if (record.documentVersion !== record.memo.currentVersion) {
    throw new WhatsAppApprovalError('The document has changed since this link was sent — use the secure portal link.');
  }
  if (!isRecognisedCommand(rawCommand)) {
    throw new WhatsAppApprovalError(
      `"${rawCommand}" is not a recognised command. Reply exactly with APPROVE, REJECT, COMMENT, REVIEW, or MORE INFORMATION.`,
    );
  }

  const command = rawCommand.trim().toUpperCase() as WhatsAppCommand;
  await prisma.whatsAppApprovalToken.update({
    where: { id: record.id },
    data: { usedAt: new Date(), command },
  });

  return { command, memoId: record.memoId };
}
