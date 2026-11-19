import { FlowStatus, FlowType, TimelineBoard } from '../core/models/flow.models';
import { canManageBoardMembers, canPostToBoard, canViewBoard, validateCrossLinkAccess } from './timelines.privacy';

const HUMAN_ID = '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b';
const AGENT_ID = 'a7e49c10-9100-4b22-a811-9000a6e17001';
const STRANGER_ID = '99999999-9999-4999-8999-999999999999';

function makeBoard(overrides: Partial<TimelineBoard>): TimelineBoard {
  return {
    id: 'board-1',
    slug: 'board-1',
    title: 'Board',
    description: '',
    icon: 'timeline',
    colorTheme: 'amber',
    boardKind: 'CUSTOM_PROJECT',
    boardMode: 'TIMELINE',
    privacy: 'PRIVATE',
    ownerProfileId: HUMAN_ID,
    flowId: 'flow-1',
    flowType: FlowType.CONTEXT,
    flowStatus: FlowStatus.ACTIVE,
    seasonsStreamSlug: 'lemon-universe',
    seasonsFeedSlug: 'universe-board-1',
    members: [],
    ...overrides,
  };
}

describe('TimeLines Privacy & Cross-Link Rules', () => {
  it('should restrict PRIVATE board visibility to owner and members', () => {
    const privateBoard = makeBoard({
      id: 'board-priv',
      privacy: 'PRIVATE',
      ownerProfileId: HUMAN_ID,
      members: [
        {
          id: 'm1',
          boardId: 'board-priv',
          profileId: AGENT_ID,
          role: 'AGENT',
          canPost: true,
          canCrossLink: true,
        },
      ],
    });

    expect(canViewBoard(privateBoard, HUMAN_ID)).toBeTrue();
    expect(canViewBoard(privateBoard, AGENT_ID)).toBeTrue();
    expect(canViewBoard(privateBoard, STRANGER_ID)).toBeFalse();
  });

  it('should deny posting for VIEWER members and allow management only for OWNER/EDITOR', () => {
    const board = makeBoard({
      id: 'board-team',
      privacy: 'PRIVATE',
      ownerProfileId: HUMAN_ID,
      members: [
        {
          id: 'm1',
          boardId: 'board-team',
          profileId: STRANGER_ID,
          role: 'VIEWER',
          canPost: true,
          canCrossLink: false,
        },
      ],
    });

    expect(canPostToBoard(board, STRANGER_ID)).toBeFalse();
    expect(canManageBoardMembers(board, STRANGER_ID)).toBeFalse();
    expect(canManageBoardMembers(board, HUMAN_ID)).toBeTrue();
  });

  it('should allow cross-links between two PRIVATE boards when agent is member of main board', () => {
    const mainPrivate = makeBoard({
      id: 'board-main-private',
      privacy: 'PRIVATE',
      ownerProfileId: HUMAN_ID,
      members: [
        {
          id: 'm1',
          boardId: 'board-main-private',
          profileId: AGENT_ID,
          role: 'AGENT',
          canPost: true,
          canCrossLink: true,
        },
      ],
    });

    const agentPrivate = makeBoard({
      id: 'board-agent-private',
      privacy: 'PRIVATE',
      ownerProfileId: AGENT_ID,
    });

    const res = validateCrossLinkAccess(mainPrivate, agentPrivate, AGENT_ID);
    expect(res.allowed).toBeTrue();
  });

  it('should block cross-links across different privacy contours (PRIVATE <-> PUBLIC)', () => {
    const publicBoard = makeBoard({ id: 'board-pub', privacy: 'PUBLIC', ownerProfileId: HUMAN_ID });
    const privateBoard = makeBoard({ id: 'board-priv', privacy: 'PRIVATE', ownerProfileId: AGENT_ID });

    const res = validateCrossLinkAccess(publicBoard, privateBoard, AGENT_ID);
    expect(res.allowed).toBeFalse();
    expect(res.reason).toContain('разные уровни приватности');
  });
});
