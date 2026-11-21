import {
  appendHashtagToText,
  applyHashtagAutocomplete,
  collectHashtagCounts,
  extractHashtagsFromText,
  getExtraTagsNotInText,
  getTrailingHashtagPrefix,
  mergeNoteTags,
  normalizeTag,
  noteHasTag,
  parseTagsInput,
  syncTagsOnTextEdit,
  tokenizeTextWithHashtags,
} from './hashtag.utils';

describe('hashtag.utils', () => {
  it('should extract Cyrillic, Latin, numeric, underscore and hyphenated hashtags', () => {
    const text = 'Запустили #релиз_v2 для #Lemon-Seasons (#идея, #2026)! Игнор https://a.b/#frag и foo#bar';
    expect(extractHashtagsFromText(text)).toEqual([
      'релиз_v2',
      'lemon-seasons',
      'идея',
      '2026',
    ]);
  });

  it('should normalize tags and parse comma or space separated tag inputs', () => {
    expect(normalizeTag('  ##Идея ')).toBe('идея');
    expect(parseTagsInput('#работа, diary; #чилл  #работа')).toEqual([
      'работа',
      'diary',
      'чилл',
    ]);
  });

  it('should merge inline hashtags and explicit tags without duplicates', () => {
    expect(mergeNoteTags('План на вечер #Кино #уют', 'уют, #вечеринка')).toEqual([
      'кино',
      'уют',
      'вечеринка',
    ]);
  });

  it('should sync tags cleanly when message text is edited', () => {
    const oldText = 'Сходил в #кино и #кафе';
    const existingTags = ['кино', 'кафе', 'дневник'];
    expect(getExtraTagsNotInText(oldText, existingTags)).toEqual(['дневник']);

    const newText = 'Сходил в #кафе и #парк';
    expect(syncTagsOnTextEdit(oldText, newText, existingTags)).toEqual([
      'кафе',
      'парк',
      'дневник',
    ]);
  });

  it('should tokenize text into text and hashtag segments preserving punctuation', () => {
    const segments = tokenizeTextWithHashtags('Привет (#мир), и #тест!');
    expect(segments).toEqual([
      { kind: 'text', value: 'Привет (' },
      { kind: 'hashtag', value: '#мир', tag: 'мир' },
      { kind: 'text', value: '), и ' },
      { kind: 'hashtag', value: '#тест', tag: 'тест' },
      { kind: 'text', value: '!' },
    ]);
  });

  it('should aggregate hashtag counts and match notes by tag', () => {
    const notes = [
      { text: 'Идея #пицца', tags: ['вечер'] },
      { text: 'Ещё #пицца #кино', tags: ['пицца'] },
    ];
    expect(collectHashtagCounts(notes)).toEqual([
      { tag: 'пицца', count: 2 },
      { tag: 'вечер', count: 1 },
      { tag: 'кино', count: 1 },
    ]);
    expect(noteHasTag(notes[0], '#Вечер')).toBe(true);
    expect(noteHasTag(notes[0], 'кино')).toBe(false);
  });

  it('should append hashtags and apply trailing hashtag autocomplete cleanly', () => {
    expect(appendHashtagToText('Мысль дня', 'идея')).toBe('Мысль дня #идея');
    expect(appendHashtagToText('Мысль дня #идея', '#Идея')).toBe('Мысль дня #идея');
    expect(getTrailingHashtagPrefix('Заметка про #рел')).toBe('рел');
    expect(getTrailingHashtagPrefix('Заметка #')).toBe('');
    expect(getTrailingHashtagPrefix('Обычный текст')).toBeNull();
    expect(applyHashtagAutocomplete('Заметка про #рел', 'релиз')).toBe('Заметка про #релиз ');
  });
});
