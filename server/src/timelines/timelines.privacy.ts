export type BoardPrivacy = 'PUBLIC' | 'PRIVATE';
export type TimelineBoardMode = 'TIMELINE' | 'DIARY' | 'AGENT_SUMMARY' | 'PARTY_CLOUD';
export type BoardMemberRole = 'OWNER' | 'EDITOR' | 'MEMBER' | 'AGENT' | 'VIEWER';

export interface BoardPrivacySubject {
  id: string;
  privacy: BoardPrivacy;
  ownerProfileId?: string | null;
}

export interface BoardMemberPermission {
  boardId: string;
  profileId: string;
  role: BoardMemberRole;
  canPost: boolean;
  canCrossLink: boolean;
}

export function canViewBoard(
  board: BoardPrivacySubject,
  profileId: string | null | undefined,
  members: BoardMemberPermission[],
): boolean {
  if (board.privacy === 'PUBLIC') return true;
  if (!profileId) return false;
  if (board.ownerProfileId === profileId) return true;
  return members.some((m) => m.boardId === board.id && m.profileId === profileId);
}

export function canPostToBoard(
  board: BoardPrivacySubject,
  profileId: string | null | undefined,
  members: BoardMemberPermission[],
): boolean {
  if (!profileId) return false;
  if (board.ownerProfileId === profileId) return true;
  const member = members.find((m) => m.boardId === board.id && m.profileId === profileId);
  if (member) {
    return member.role !== 'VIEWER' && member.canPost;
  }
  return board.privacy === 'PUBLIC';
}

export function canManageBoardMembers(
  board: BoardPrivacySubject,
  profileId: string | null | undefined,
  members: BoardMemberPermission[],
): boolean {
  if (!profileId) return false;
  if (board.ownerProfileId === profileId) return true;
  const member = members.find((m) => m.boardId === board.id && m.profileId === profileId);
  return Boolean(member && (member.role === 'OWNER' || member.role === 'EDITOR'));
}

export interface CrossLinkValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Enforces the strict TimeLines cross-link privacy invariant:
 * 1. Source and target boards must be in the exact same privacy field (PUBLIC <-> PUBLIC or PRIVATE <-> PRIVATE).
 * 2. The acting profile (human user or AI agent) must have cross-link write permission on the source board
 *    and visibility/membership access on the target board (plus cross-link permission if pushing onto a shared main board).
 */
export function validateCrossLinkAccess(
  sourceBoard: BoardPrivacySubject,
  targetBoard: BoardPrivacySubject,
  profileId: string | null | undefined,
  sourceMembers: BoardMemberPermission[],
  targetMembers: BoardMemberPermission[],
): CrossLinkValidationResult {
  if (sourceBoard.id === targetBoard.id) {
    return { allowed: true };
  }

  if (sourceBoard.privacy !== targetBoard.privacy) {
    return {
      allowed: false,
      reason: `Кросс-ссылка запрещена: доски находятся в разных контурах приватности (${sourceBoard.privacy} → ${targetBoard.privacy}). Ссылки разрешены только в одном поле видимости.`,
    };
  }

  if (!profileId) {
    return { allowed: false, reason: 'Не указан активный профиль пользователя или агента.' };
  }

  const canActOnSource = canPostToBoard(sourceBoard, profileId, sourceMembers);
  const sourceMember = sourceMembers.find((m) => m.boardId === sourceBoard.id && m.profileId === profileId);
  const sourceLinkAllowed =
    sourceBoard.ownerProfileId === profileId ||
    (sourceMember ? sourceMember.canCrossLink && sourceMember.role !== 'VIEWER' : canActOnSource);

  if (!sourceLinkAllowed) {
    return {
      allowed: false,
      reason: 'У текущего профиля нет прав на создание кросс-ссылок в исходном TimeLine.',
    };
  }

  const canSeeTarget = canViewBoard(targetBoard, profileId, targetMembers);
  if (!canSeeTarget) {
    return {
      allowed: false,
      reason: 'Целевой приватный TimeLine недоступен текущему профилю (добавьте профиль в members целевого борда).',
    };
  }

  return { allowed: true };
}
