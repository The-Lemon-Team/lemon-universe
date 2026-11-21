import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractHashtagsFromText,
  mergeNoteTags,
  normalizeTag,
  syncTagsOnTextEdit,
} from '../src/timelines/hashtag.utils';

test('extractHashtagsFromText parses multilingual hashtags and skips URLs', () => {
  const tags = extractHashtagsFromText(
    'Тестируем #Хештег и #vibe-coding, игнорируем https://example.com/#frag',
  );
  assert.deepEqual(tags, ['хештег', 'vibe-coding']);
});

test('mergeNoteTags deduplicates inline hashtags and explicit tags', () => {
  assert.equal(normalizeTag(' #Идея '), 'идея');
  const merged = mergeNoteTags('Мысль #Идея #кино', ['#идея', 'работа', '']);
  assert.deepEqual(merged, ['идея', 'кино', 'работа']);
});

test('syncTagsOnTextEdit updates inline hashtags while preserving manual tags', () => {
  const updated = syncTagsOnTextEdit(
    'Старт #утро #план',
    'Старт #день #релиз',
    ['утро', 'план', 'diary'],
  );
  assert.deepEqual(updated, ['день', 'релиз', 'diary']);
});
