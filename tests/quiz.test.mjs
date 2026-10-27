import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARENT_QUIZ, pickQuestions } from '../js/data/parent-quiz.js';

test('Eltern-Quiz: genug Fragen, eindeutige ids, je 4 verschiedene Antworten', () => {
  assert.ok(PARENT_QUIZ.length >= 50);
  assert.equal(new Set(PARENT_QUIZ.map(x => x.id)).size, PARENT_QUIZ.length);
  assert.equal(new Set(PARENT_QUIZ.map(x => x.q)).size, PARENT_QUIZ.length);
  for (const x of PARENT_QUIZ) {
    assert.equal(x.a.length, 4, x.id);
    assert.equal(new Set(x.a).size, 4, x.id);
  }
});

test('Eltern-Quiz: zieht verschiedene Fragen, meidet zuletzt gestellte, Antworten gemischt aber vollständig', () => {
  const recent = PARENT_QUIZ.slice(0, 20).map(x => x.id);
  for (let i = 0; i < 500; i++) {
    const qs = pickQuestions(2, recent);
    assert.equal(qs.length, 2);
    assert.notEqual(qs[0].id, qs[1].id);
    for (const q of qs) {
      assert.ok(!recent.includes(q.id));
      const src = PARENT_QUIZ.find(x => x.id === q.id);
      assert.equal(q.correct, src.a[0]);
      assert.deepEqual([...q.answers].sort(), [...src.a].sort());
    }
  }
  // Alle schon gestellt: dann eben aus dem ganzen Katalog
  assert.equal(pickQuestions(2, PARENT_QUIZ.map(x => x.id)).length, 2);
});
