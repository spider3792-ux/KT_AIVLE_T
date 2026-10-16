// js/storage.js: the localStorage wrapper that never throws. A fake backend stands in for window.localStorage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/storage.js';

function fakeBackend(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      data.set(k, String(v));
    },
    removeItem: (k) => {
      data.delete(k);
    },
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

function quotaError() {
  const err = new Error('The quota has been exceeded.');
  err.name = 'QuotaExceededError';
  return err;
}

test('round trip: values are namespaced and wrapped with v: 1', () => {
  const backend = fakeBackend();
  const store = createStore(() => backend);
  assert.equal(store.persistent, true);
  assert.equal(store.set('draft:2026-W42', { member: '이주현', answers: { q1: 2, q3: 'isna().sum()' } }), true);
  assert.deepEqual(store.get('draft:2026-W42'), { v: 1, member: '이주현', answers: { q1: 2, q3: 'isna().sum()' } });
  const raw = JSON.parse(backend.getItem('srq:draft:2026-W42'));
  assert.equal(raw.v, 1);
  assert.equal(raw.member, '이주현');
  assert.equal(store.get('missing'), null);
});

test('a backend factory that throws gives persistent false and still serves values from memory', () => {
  const store = createStore(() => {
    throw new DOMException('denied', 'SecurityError');
  });
  assert.equal(store.persistent, false);
  assert.equal(store.set('member', { name: '김준수' }), false);
  assert.deepEqual(store.get('member'), { v: 1, name: '김준수' });
  assert.deepEqual(store.keys(''), ['member']);
});

test('a QuotaExceededError on write returns false, turns persistence off and keeps the value readable', () => {
  const backend = fakeBackend();
  const store = createStore(() => backend);
  assert.equal(store.persistent, true);
  backend.setItem = () => {
    throw quotaError();
  };
  assert.equal(store.set('draft:2026-W42', { answers: { q1: 1 } }), false);
  assert.equal(store.persistent, false);
  assert.deepEqual(store.get('draft:2026-W42'), { v: 1, answers: { q1: 1 } });
});

test('a zero-quota backend that throws on the probe write starts non-persistent', () => {
  const backend = fakeBackend();
  backend.setItem = () => {
    throw quotaError();
  };
  const store = createStore(() => backend);
  assert.equal(store.persistent, false);
  assert.equal(store.set('member', { name: 'a' }), false);
  assert.deepEqual(store.get('member'), { v: 1, name: 'a' });
});

test('stored JSON with another version, or invalid JSON, reads as null', () => {
  const backend = fakeBackend({
    'srq:old': JSON.stringify({ v: 2, name: 'x' }),
    'srq:none': JSON.stringify({ name: 'x' }),
    'srq:broken': '{not json',
    'srq:array': '[1,2]',
    'srq:text': '"hello"',
  });
  const store = createStore(() => backend);
  for (const key of ['old', 'none', 'broken', 'array', 'text']) assert.equal(store.get(key), null, key);
});

test('remove deletes from both the backend and memory', () => {
  const backend = fakeBackend();
  const store = createStore(() => backend);
  store.set('draft:a', { answers: {} });
  assert.ok(backend.getItem('srq:draft:a'));
  store.remove('draft:a');
  assert.equal(backend.getItem('srq:draft:a'), null);
  assert.equal(store.get('draft:a'), null);
  assert.deepEqual(store.keys('draft:'), []);

  // memory layer alone (non-persistent store)
  const blocked = createStore(() => {
    throw new Error('blocked');
  });
  blocked.set('draft:b', { answers: {} });
  blocked.remove('draft:b');
  assert.equal(blocked.get('draft:b'), null);
});

test("keys('draft:') lists only namespaced keys with that prefix, without the srq: prefix", () => {
  const backend = fakeBackend({
    'other:draft:x': '{}',
    'draft:no-namespace': '{}',
    'srq:member': JSON.stringify({ v: 1, name: 'a' }),
  });
  const store = createStore(() => backend);
  store.set('draft:2026-W41', { answers: {} });
  store.set('draft:2026-W42', { answers: {} });
  store.set('attempt:2026-W41', { score: {} });
  assert.deepEqual(store.keys('draft:').sort(), ['draft:2026-W41', 'draft:2026-W42']);
  assert.deepEqual(store.keys('attempt:'), ['attempt:2026-W41']);
  assert.ok(!store.keys('').includes('probe'), 'the probe key never leaks');
  assert.ok(store.keys('').every((k) => !k.startsWith('srq:')), 'no srq: prefix in listed keys');
});
