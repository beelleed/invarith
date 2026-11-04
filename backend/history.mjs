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
    async tasks() {
      const tasks = await read('verification-tasks.json', []);
      return tasks.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    },
    saveTask: task => serial(async () => {
      if (!task || !validId(task.id) || typeof task.title !== 'string' || task.title.length > 120 || !Number.isSafeInteger(task.revision) || task.revision < 0) throw new AppError(400, 'Invalid saved question.');
      const draft=task.draft;
      const limits={code:24000,functionName:80,intent:4000,cases:30000};
      if (!draft || Object.entries(limits).some(([key,limit])=>typeof draft[key]!=='string'||draft[key].length>limit) || !['python','javascript','typescript','java','cpp','go','rust','csharp','kotlin','c','ruby','php'].includes(draft.codeLanguage)) throw new AppError(400,'Invalid question draft.');
      for (const id of [task.activeRunId,task.baselineRunId]) if (id !== null) await get(id);
      const tasks=await read('verification-tasks.json',[]),index=tasks.findIndex(row=>row.id===task.id),previous=tasks[index];
      if ((previous?.revision||0)!==task.revision) throw new AppError(409,'This question changed in another tab. Reopen it before saving.');
      if(index<0&&tasks.length>=500)throw new AppError(400,'Your saved question collection is full.');
      const saved={id:task.id,title:task.title.trim(),draft:Object.fromEntries(['codeLanguage',...Object.keys(limits)].map(key=>[key,draft[key]])),activeRunId:task.activeRunId,baselineRunId:task.baselineRunId,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),revision:(previous?.revision||0)+1};
      if(index<0)tasks.push(saved);else tasks[index]=saved;
      await write('verification-tasks.json',tasks);return saved;
    }),
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
