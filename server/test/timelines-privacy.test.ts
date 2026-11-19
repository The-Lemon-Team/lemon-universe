import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BoardMemberPermission,
  BoardPrivacySubject,
  canManageBoardMembers,
  canPostToBoard,
  canViewBoard,
  validateCrossLinkAccess,
} from '../src/timelines/timelines.privacy';

const HUMAN_ID = '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b';
const AGENT_ID = 'a7e49c10-9100-4b22-a811-9000a6e17001';
const STRANGER_ID = '99999999-9999-4999-8999-999999999999';

const publicMain: BoardPrivacySubject = {
  id: 'board-global-day',
  privacy: 'PUBLIC',
  ownerProfileId: HUMAN_ID,
};

const privateMain: BoardPrivacySubject = {
  id: 'board-private-main',
  privacy: 'PRIVATE',
  ownerProfileId: HUMAN_ID,
};

const privateAgentBoard: BoardPrivacySubject = {
  id: 'board-agent-private',
  privacy: 'PRIVATE',
  ownerProfileId: AGENT_ID,
};

const publicAgentBoard: BoardPrivacySubject = {
  id: 'board-agent-public',
  privacy: 'PUBLIC',
  ownerProfileId: AGENT_ID,
};

test('private board is only visible to owner and explicit members', () => {
  const members: BoardMemberPermission[] = [
    { boardId: privateMain.id, profileId: AGENT_ID, role: 'AGENT', canPost: true, canCrossLink: true },
  ];

  assert.equal(canViewBoard(privateMain, HUMAN_ID, members), true);
  assert.equal(canViewBoard(privateMain, AGENT_ID, members), true);
  assert.equal(canViewBoard(privateMain, STRANGER_ID, members), false);
});

test('viewer member cannot post or manage members', () => {
  const members: BoardMemberPermission[] = [
    { boardId: privateMain.id, profileId: STRANGER_ID, role: 'VIEWER', canPost: true, canCrossLink: false },
  ];
  assert.equal(canViewBoard(privateMain, STRANGER_ID, members), true);
  assert.equal(canPostToBoard(privateMain, STRANGER_ID, members), false);
  assert.equal(canManageBoardMembers(privateMain, STRANGER_ID, members), false);
  assert.equal(canManageBoardMembers(privateMain, HUMAN_ID, members), true);
});

test('cross-link succeeds between PRIVATE boards when agent is member of main private board', () => {
  const sourceMembers: BoardMemberPermission[] = [
    { boardId: privateAgentBoard.id, profileId: AGENT_ID, role: 'OWNER', canPost: true, canCrossLink: true },
  ];
  const targetMembers: BoardMemberPermission[] = [
    { boardId: privateMain.id, profileId: AGENT_ID, role: 'AGENT', canPost: true, canCrossLink: true },
  ];

  const res = validateCrossLinkAccess(
    privateMain,
    privateAgentBoard,
    AGENT_ID,
    targetMembers,
    sourceMembers,
  );
  assert.equal(res.allowed, true);
});

test('cross-link is blocked across different privacy fields (PRIVATE <-> PUBLIC)', () => {
  const res1 = validateCrossLinkAccess(publicMain, privateAgentBoard, AGENT_ID, [], []);
  assert.equal(res1.allowed, false);
  assert.match(res1.reason || '', /разных контурах приватности/);

  const res2 = validateCrossLinkAccess(privateMain, publicAgentBoard, HUMAN_ID, [], []);
  assert.equal(res2.allowed, false);
});

test('cross-link is blocked if profile is not a member of target private board', () => {
  const res = validateCrossLinkAccess(privateAgentBoard, privateMain, AGENT_ID, [], []);
  assert.equal(res.allowed, false);
  assert.match(res.reason || '', /members/);
});
