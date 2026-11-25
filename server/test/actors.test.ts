import test from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { ACTORS_SEED } from '../src/actors/actors.seed';
import { ActorsService } from '../src/actors/actors.service';

function createMockDb(rows: any[] = [], shouldThrow = false) {
  return {
    query: async () => {
      if (shouldThrow) throw new Error('DB offline');
      return { rows };
    },
  } as any;
}

test('ActorsService.findAll falls back to full 22 canonical character cards when DB is offline', async () => {
  const service = new ActorsService(createMockDb([], true));
  const cards = await service.findAll();
  assert.equal(cards.length, ACTORS_SEED.length);
  assert.ok(cards.length >= 22);

  const akin = cards.find((c) => c.id === 'actor-akin');
  assert.ok(akin, 'Expected actor-akin card');
  assert.equal(akin.name, 'Акин');
  assert.equal(akin.handle, 'akin_guardian');
  assert.equal(typeof akin.traits.charisma, 'number');
  assert.equal(typeof akin.sampleVoices.support, 'string');
  assert.equal(typeof akin.voicePitch, 'number');
  assert.equal(typeof akin.voicesCount, 'number');
  assert.ok(akin.affinities.includes('огонь'));
});

test('ActorsService.findAll filters by category, tower, and search query', async () => {
  const service = new ActorsService(createMockDb([], true));

  const fireActors = await service.findAll({ tower: 'FIRE' });
  assert.ok(fireActors.some((a) => a.id === 'actor-akin'));
  assert.ok(fireActors.some((a) => a.id === 'actor-hades'));
  assert.ok(fireActors.some((a) => a.id === 'actor-ansy'));
  assert.ok(!fireActors.some((a) => a.id === 'actor-yuka'));

  const sages = await service.findAll({ category: 'SAGE' });
  assert.ok(sages.every((a) => a.category === 'SAGE'));
  assert.ok(sages.some((a) => a.id === 'actor-neurobi'));

  const searchRes = await service.findAll({ search: 'Нейроби' });
  assert.equal(searchRes.length, 1);
  assert.equal(searchRes[0].id, 'actor-neurobi');
});

test('ActorsService.findOne resolves by id or handle and throws NotFoundException when missing', async () => {
  const service = new ActorsService(createMockDb([], true));

  const byId = await service.findOne('actor-hades');
  assert.equal(byId.name, 'Аид');

  const byHandle = await service.findOne('AKIN_GUARDIAN');
  assert.equal(byHandle.id, 'actor-akin');

  await assert.rejects(() => service.findOne('actor-unknown-404'), NotFoundException);
});

test('ActorsService.mapRowToCard enriches DB rows with full ArenaActorCard fields', () => {
  const service = new ActorsService(createMockDb());
  const mapped = service.mapRowToCard({
    id: 'actor-alexey',
    handle: 'alexey_bathrobe',
    flowId: 'flow-actor-alexey',
    ownerProfileId: '1f3e6a64-721c-4d1d-8d52-6c3f4e30d30b',
    name: 'Алексей (в халате)',
    title: 'Архитектор Уюта',
    category: 'HUMAN',
    categoryLabel: 'Человек',
    avatarIcon: 'alexey',
    accentColor: 'rose',
    rankLabel: 'Голос Поля',
    quote: 'Цитата',
    paradoxPhilosophy: 'Философия',
    favoriteDesire: 'Кино',
    affinities: ['пицца'],
    traits: { charisma: 95, analytical: 80, rebelVersus: 65 },
    sampleVoices: { support: 'Да', counter: 'Нет', paradox: 'Баланс' },
    isLead: true,
    voicePitch: 1.0,
    voiceRate: 1.0,
    voicesCount: 12,
  });

  assert.equal(mapped.id, 'actor-alexey');
  assert.equal(mapped.isLead, true);
  assert.equal(mapped.voicesCount, 12);
  assert.equal(mapped.sampleVoices.support, 'Да');
});
