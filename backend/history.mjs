import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './verification.mjs';

const validId = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
export function createHistoryStore(directory) {
  let queue = Promise.resolve();
  const serial = task => { const next = queue.then(task); queue = next.catch(() => {}); return next; };
  async function read(name, fallback) {
    try { return JSON.parse(await readFile(join(directory, name), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw new AppError(503, 'Saved history could not be read. Your files have been preserved.'); }
  }
  async function write(name, value) {
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, `${name}.${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, join(directory, name));
  }
  async function get(id) {
    if (!validId(id)) throw new AppError(404, 'Saved verification was not found.');
    const record = await read(`${id}.json`, null);
    if (!record) throw new AppError(404, 'Saved verification was not found.');
    return record;
  }
  return {
    get,
    save: record => serial(() => write(`${record.evidence.id}.json`, record)),
    saveMutationCheck: (id,report) => serial(async()=>{const record=await get(id);record.evidence.mutationCheck=report;await write(`${id}.json`,record);}),
    saveRequirementMap: (id,map,expectedMapId) => serial(async()=>{const record=await get(id);if(expectedMapId && record.evidence.requirementMap?.id!==expectedMapId)throw new AppError(409,'The requirement map changed. Reopen the saved run.');record.evidence.requirementMap=map;await write(`${id}.json`,record);}),
    saveShrink: (id,key,report) => serial(async()=>{const record=await get(id);record.evidence.shrinks ||= {};record.evidence.shrinks[key]=report;await write(`${id}.json`,record);}),
    saveChallenge: (id,key,plan) => serial(async()=>{const record=await get(id);record.challenges ||= {};record.challenges[key]=plan;await write(`${id}.json`,record);}),
    saveSecurity: (id, code, security) => serial(async () => { const record = await get(id); if(record.submission.code !== code) throw new AppError(409,'The source changed. Review the current code separately.'); record.evidence.security=security; await write(`${id}.json`,record); }),
    saveHint: (id, key, hint) => serial(async () => { const record = await get(id); record.hints ||= {}; record.hints[key] = hint; await write(`${id}.json`, record); }),
    updateMentor: (id, update) => serial(async () => { const record = await get(id); record.mentor = update(record.mentor || {}); await write(`${id}.json`, record); return record.mentor; }),
    async list() {
      let files; try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
      const records = await Promise.all(files.filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(file => get(file.slice(0, -5))));
      return records.sort((a,b) => b.time - a.time).slice(0,100).map(record => ({ id: record.evidence.id, functionName: record.submission.functionName, createdAt: record.evidence.createdAt || new Date(record.time).toISOString(), passed: record.evidence.passed, total: record.evidence.total, execution:record.evidence.execution || null,hintCount: Object.keys(record.hints || {}).length }));
    },
    workspace: () => read('workspace.json', { activeRunId: null, baselineRunId: null }),
    saveWorkspace: state => serial(async () => {
      for (const id of [state.activeRunId, state.baselineRunId]) if (id !== null) await get(id);
      const saved = { activeRunId: state.activeRunId, baselineRunId: state.baselineRunId };
      await write('workspace.json', saved); return saved;
    }),
  };
}
