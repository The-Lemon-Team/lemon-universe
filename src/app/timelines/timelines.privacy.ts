import {
  BoardMemberRole,
  BoardPrivacy,
  TimelineBoard,
  TimelineBoardMember,
} from '../core/models/flow.models';

export function getBoardPrivacy(board: Pick<TimelineBoard, 'privacy'>): BoardPrivacy {
  return board.privacy === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
}

export function canViewBoard(
  board: TimelineBoard,
  profileId: string | null | undefined,
): boolean {
  if (getBoardPrivacy(board) === 'PUBLIC') return true;
  if (!profileId) return false;
  if (board.ownerProfileId === profileId) return true;
  return (board.members ?? []).some((m) => m.profileId === profileId);
}

export function canPostToBoard(
  board: TimelineBoard,
  profileId: string | null | undefined,
): boolean {
  if (!profileId) return false;
  if (board.ownerProfileId === profileId) return true;
  const member = (board.members ?? []).find((m) => m.profileId === profileId);
  if (member) {
    return member.role !== 'VIEWER' && member.canPost;
  }
  return getBoardPrivacy(board) === 'PUBLIC';
}

export function canManageBoardMembers(
  board: TimelineBoard,
  profileId: string | null | undefined,
): boolean {
  if (!profileId) return false;
  if (board.ownerProfileId === profileId) return true;
  const member = (board.members ?? []).find((m) => m.profileId === profileId);
  return Boolean(member && (member.role === 'OWNER' || member.role === 'EDITOR'));
}

export function validateCrossLinkAccess(
  sourceBoard: TimelineBoard,
  targetBoard: TimelineBoard,
  profileId: string | null | undefined,
): { allowed: boolean; reason?: string } {
  if (sourceBoard.id === targetBoard.id) return { allowed: true };

  const srcPrivacy = getBoardPrivacy(sourceBoard);
  const tgtPrivacy = getBoardPrivacy(targetBoard);

  if (srcPrivacy !== tgtPrivacy) {
    return {
      allowed: false,
      reason: `Кросс-ссылка запрещена: разные уровни приватности (${srcPrivacy} → ${tgtPrivacy}). Разрешены ссылки только внутри одного поля видимости.`,
    };
  }

  if (!profileId) {
    return { allowed: false, reason: 'Не выбран активный профиль пользователя или агента.' };
  }

  const srcMember = (sourceBoard.members ?? []).find((m) => m.profileId === profileId);
  const canCrossLinkSource =
    sourceBoard.ownerProfileId === profileId ||
    (srcMember ? srcMember.canCrossLink && srcMember.role !== 'VIEWER' : canPostToBoard(sourceBoard, profileId));

  if (!canCrossLinkSource) {
    return {
      allowed: false,
      reason: 'У текущего профиля нет прав на отправку кросс-ссылок из этого TimeLine.',
    };
  }

  if (!canViewBoard(targetBoard, profileId)) {
    return {
      allowed: false,
      reason: 'Целевой приватный TimeLine недоступен: добавьте профиль в members целевого борда.',
    };
  }

  return { allowed: true };
}

export function roleLabel(role: BoardMemberRole): string {
  switch (role) {
    case 'OWNER':
      return 'Владелец';
    case 'EDITOR':
      return 'Редактор';
    case 'AGENT':
      return 'AI-Агент';
    case 'VIEWER':
      return 'Наблюдатель';
    default:
      return 'Участник';
  }
}
