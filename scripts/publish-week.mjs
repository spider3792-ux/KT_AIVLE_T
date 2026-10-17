// Puts one week's set on the site: check it, add it to quizzes/index.json, commit and push.
//   node scripts/publish-week.mjs <week-id> [--no-git] [--no-push] [--today YYYY-MM-DD]
// The weekly-quiz skill runs this only after 승환 says yes. Exit 0 ok, 1 check failed, 2 usage / git problem.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { entryFor, upsertIndex, WEEK_ID } from './lib/publish-core.mjs';
import { kstToday } from './lib/week-core.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = args.find((a) => WEEK_ID.test(a));

function fail(code, message) {
  console.error(message);
  process.exit(code);
}
function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' });
  return r.status ?? 1;
}
const readJson = (rel) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/^﻿/, ''));

if (!id) fail(2, '사용법: node scripts/publish-week.mjs <주차 id, 예: 2026-W43> [--no-git] [--no-push]');
const setPath = `quizzes/${id}.json`;
if (!existsSync(new URL(`../${setPath}`, import.meta.url))) fail(2, `세트 파일이 없어요: ${setPath}`);

// 1. The set itself must pass before anything changes.
if (run(process.execPath, ['scripts/validate-quiz.mjs', setPath]) !== 0) fail(1, '세트 검사를 통과하지 못해서 올리지 않았어요.');

// 2. Add (or replace) the week in the list, newest first.
const today = opt('--today') ?? kstToday();
const { index, replaced } = upsertIndex(readJson('quizzes/index.json'), entryFor(readJson(setPath), today));
writeFileSync(new URL('../quizzes/index.json', import.meta.url), JSON.stringify(index, null, 2) + '\n', 'utf8');
if (run(process.execPath, ['scripts/validate-quiz.mjs', 'quizzes/index.json']) !== 0) fail(1, '주차 목록 검사를 통과하지 못했어요. quizzes/index.json을 확인해 주세요.');
console.log(`${replaced ? '교체' : '추가'}: ${id} → quizzes/index.json (맨 앞이 이번 주로 보여요)`);

if (flag('--no-git')) process.exit(0);

// 3. Commit only these two files, then push.
if (run('git', ['add', '--', setPath, 'quizzes/index.json']) !== 0) fail(2, 'git add에 실패했어요.');
const staged = spawnSync('git', ['diff', '--cached', '--quiet', '--', setPath, 'quizzes/index.json'], { cwd: ROOT });
if (staged.status === 0) {
  console.log('바뀐 내용이 없어서 커밋하지 않았어요.');
} else if (run('git', ['commit', '-m', `quiz: ${id} 주간 세트 올리기`, '--', setPath, 'quizzes/index.json']) !== 0) {
  fail(2, 'git commit에 실패했어요.');
}
if (flag('--no-push')) process.exit(0);
if (run('git', ['push']) !== 0) fail(2, 'git push에 실패했어요. 인터넷 연결과 GitHub 로그인을 확인해 주세요.');
console.log('올렸어요. 1~2분 뒤 사이트에서 새 주차가 보여요.');
