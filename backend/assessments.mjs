import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {AppError,validateSubmission,verify} from './verification.mjs';
import {practiceTasks,practiceSuite,practiceStarter} from './practice-contracts.mjs';
import {practiceDifficulty} from '../frontend/practice-difficulty.mjs';
import {practiceTopics} from '../frontend/practice-topics.mjs';
import {assessmentReviewFingerprint,assessmentReviewReason,assessmentReviewSchedule} from './assessment-review.mjs';

export function createAssessments({directory='./data/assessments',run=verify,practiceTask,createPracticeReview,practiceReviewState,now=()=>Date.now()}={}){
  const locks=new Map();
  const stamp=()=>new Date(now()).toISOString();
  const path=id=>{if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new AppError(404,'Assessment not found.');return join(directory,id+'.json');};
  const get=async id=>{try{return JSON.parse(await readFile(path(id),'utf8'));}catch(error){if(error instanceof AppError)throw error;throw new AppError(error.code==='ENOENT'?404:503,'Assessment not found.');}};
  const save=async session=>{session.updatedAt=stamp();await mkdir(directory,{recursive:true});const tmp=join(directory,`${session.id}.${randomUUID()}.tmp`);await writeFile(tmp,JSON.stringify(session),{mode:0o600});await rename(tmp,path(session.id));};
  const expired=session=>now()>=Date.parse(session.deadlineAt);
  const view=session=>({id:session.id,status:session.status,source:session.source,language:session.language,minutes:session.minutes,createdAt:session.createdAt,updatedAt:session.updatedAt,deadlineAt:session.deadlineAt,serverNow:stamp(),expired:expired(session),revision:session.revision,currentQuestionId:session.currentQuestionId,submittedAt:session.submittedAt||null,finishedAt:session.finishedAt||null,finishReason:session.finishReason||null,summary:session.summary||null,gradingError:session.gradingError||null,questions:session.questions.map(q=>({id:q.id,contractId:q.contractId,title:q.title,topic:q.topic,difficulty:q.difficulty,kind:q.kind,functionName:q.functionName,contract:q.contract,examples:q.examples,generationCheck:q.generationCheck||null,priorExposure:Boolean(q.sourcePracticeId),sourcePracticeId:q.sourcePracticeId||null,reviewPracticeId:q.reviewPracticeId||null,starterCode:q.starterCode,code:q.code,casesText:q.casesText,marked:Boolean(q.marked),exampleRun:q.exampleRun||null,...(session.status==='finished'?{evaluation:q.evaluation}:{} )}))});
  const exclusive=(id,job)=>{if(locks.has(id))throw new AppError(429,'This assessment is busy. Try again after the current action.');const pending=Promise.resolve().then(job);locks.set(id,pending);return pending.finally(()=>locks.delete(id));};
  const checkRevision=(session,revision)=>{if(!Number.isInteger(revision)||revision!==session.revision)throw new AppError(409,'This assessment changed. Reopen it before saving.');};
  const active=session=>{if(session.status!=='active')throw new AppError(409,'This assessment is already submitted.');if(expired(session))throw new AppError(403,'Time is up. Only drafts saved before the deadline can be graded.');};
  const find=(session,id)=>{const q=session.questions.find(q=>q.id===id);if(!q)throw new AppError(400,'Choose a question from this assessment.');return q;};
  async function judge(q,code,cases){
    const input=validateSubmission({code,functionName:q.functionName,cases});
    const evidence=await run({...input,cases:cases.map(c=>({args:structuredClone(c.args),...(c.kwargs?{kwargs:structuredClone(c.kwargs)}:{}),expected:null}))});
    if(!Array.isArray(evidence.results)||evidence.results.length!==cases.length||evidence.results.some((r,i)=>r.index!==i||!['passed','failed','error'].includes(r.status)||r.status!=='error'&&!Object.hasOwn(r,'actual')))throw new AppError(502,'Incomplete assessment execution evidence.');
    const results=evidence.results.map((r,i)=>({index:i,status:r.status==='error'?'error':isDeepStrictEqual(r.actual,cases[i].expected)?'passed':'failed',...(r.status==='error'?{error:r.error}:{actual:r.actual})}));
    const failure=results.find(r=>r.status!=='passed');
    return {status:'completed',passed:results.filter(r=>r.status==='passed').length,total:cases.length,execution:evidence.execution||'python',completedAt:stamp(),firstFailure:failure?{...failure,args:cases[failure.index].args,kwargs:cases[failure.index].kwargs||{},expected:cases[failure.index].expected}:null};
  }
  return {
    async reviewIndex(){
      let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return {pending:[],completed:[],counts:{assessments:0,questionAttempts:0,pending:0,completed:0},scope:'latest_100_finished_assessments'};throw error;}
      const sessions=(await Promise.all(files.filter(f=>/^[a-f0-9-]{36}\.json$/.test(f)).map(f=>get(f.slice(0,-5))))).filter(s=>s.status==='finished').sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt)).slice(0,100),entries=[];
      for(const session of sessions)for(const q of session.questions){const reason=assessmentReviewReason(q);if(!reason)continue;
        const practice=q.reviewPracticeId&&practiceReviewState?await practiceReviewState(q.reviewPracticeId,assessmentReviewFingerprint(q)):{status:'not_started',comparable:false};
        entries.push({assessmentId:session.id,questionId:q.id,contractId:q.contractId,title:q.title,topic:q.topic,difficulty:q.difficulty,kind:q.kind,reason,marked:Boolean(q.marked),finishedAt:session.finishedAt,oa:{status:q.evaluation.status,passed:q.evaluation.passed,total:q.evaluation.total},practiceId:q.reviewPracticeId||null,practice,schedule:assessmentReviewSchedule(practice,session.finishedAt,now())});
      }
      return {pending:entries.filter(e=>e.practice.status!=='practice_passed'),completed:entries.filter(e=>e.practice.status==='practice_passed'),counts:{assessments:sessions.length,questionAttempts:sessions.reduce((n,s)=>n+s.questions.length,0),pending:entries.filter(e=>e.practice.status!=='practice_passed').length,completed:entries.filter(e=>e.practice.status==='practice_passed').length},scope:'latest_100_finished_assessments'};
    },
    review(body){return exclusive(body.id,async()=>{const session=await get(body.id);if(session.status!=='finished')throw new AppError(409,'Finish the assessment before starting review practice.');if(!createPracticeReview)throw new AppError(503,'Review practice is unavailable.');const q=find(session,body.questionId);
      const practice=await createPracticeReview({assessmentId:session.id,question:{...q,language:session.language}});q.reviewPracticeId=practice.id;await save(session);return {practiceId:practice.id,topic:q.topic,assessmentId:session.id,questionId:q.id,cached:Boolean(practice.cached)};
    });},
    async list(){let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return [];throw error;}const all=await Promise.all(files.filter(f=>/^[a-f0-9-]{36}\.json$/.test(f)).map(f=>get(f.slice(0,-5))));return all.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100).map(s=>({id:s.id,status:s.status,source:s.source,count:s.questions.length,minutes:s.minutes,deadlineAt:s.deadlineAt,expired:expired(s),updatedAt:s.updatedAt,summary:s.summary||null}));},
    async get(id){return view(await get(id));},
    async start(body){
      if(![2,3].includes(body.count)||![30,60,90].includes(body.minutes)||!['en-US','zh-TW'].includes(body.language)||!['curated','saved'].includes(body.source))throw new AppError(400,'Choose 2 or 3 questions and a 30, 60 or 90 minute time limit.');
      const id=randomUUID(),questions=[];
      if(body.source==='saved'){
        if(!practiceTask||!Array.isArray(body.practiceIds)||body.practiceIds.length!==body.count||new Set(body.practiceIds).size!==body.count)throw new AppError(400,'Select a different saved question for each assessment slot.');
        for(const practiceId of body.practiceIds){const task=await practiceTask(practiceId,body.language);questions.push({id:randomUUID(),contractId:task.practiceTaskId,title:task.title,topic:task.topic,difficulty:task.difficulty,kind:task.kind||'curated',functionName:task.functionName,contract:task.prompt,examples:structuredClone(task.examples),hidden:structuredClone(task.evaluation),generationCheck:task.generationCheck||null,starterCode:task.starterCode,sourcePracticeId:practiceId});}
      }else{
        const topic=body.topic||'mixed',difficulty=body.difficulty||'any';if(topic!=='mixed'&&!practiceTopics.some(t=>t.id===topic)||!['any','easy','medium','hard'].includes(difficulty))throw new AppError(400,'Choose a supported topic and difficulty.');
        const candidates=Object.keys(practiceTasks).filter(taskId=>(topic==='mixed'||taskId.split(':')[0]===topic)&&(difficulty==='any'||practiceDifficulty(taskId)===difficulty))
          .map(taskId=>({taskId,key:createHash('sha256').update(id+taskId).digest('hex')})).sort((a,b)=>a.key.localeCompare(b.key));
        const chosen=[],seen=new Set();for(const item of candidates){const family=item.taskId.split(':')[0];if(!seen.has(family)){chosen.push(item);seen.add(family);}if(chosen.length===body.count)break;}for(const item of candidates){if(chosen.length===body.count)break;if(!chosen.some(c=>c.taskId===item.taskId))chosen.push(item);}
        if(chosen.length<body.count)throw new AppError(400,'Not enough different questions match these filters. Change the topic, difficulty or question count.');
        for(const {taskId}of chosen){const task=practiceTasks[taskId],topic=taskId.split(':')[0],label=practiceTopics.find(t=>t.id===topic),level=taskId.split(':')[1]||'standard',suite=practiceSuite(taskId,id+taskId);questions.push({id:randomUUID(),contractId:taskId,title:(body.language==='zh-TW'?label.zh:label.en)+' · '+(body.language==='zh-TW'?({standard:'核心',extended:'延伸',challenge:'挑戰'})[level]:({standard:'Core',extended:'Extension',challenge:'Challenge'})[level]),topic,difficulty:practiceDifficulty(taskId),kind:'curated',functionName:task.name,contract:body.language==='zh-TW'?task.zh:task.en,examples:suite.examples,hidden:suite.hidden,starterCode:practiceStarter(taskId,'coding')});}
      }
      if(new Set(questions.map(q=>q.contractId)).size!==questions.length)throw new AppError(400,'The selected questions repeat the same contract. Choose different questions.');
      for(const q of questions){q.code=q.starterCode;q.casesText=JSON.stringify(q.examples,null,2);q.marked=false;}
      const createdAt=stamp(),session={id,status:'active',source:body.source,language:body.language,minutes:body.minutes,createdAt,deadlineAt:new Date(now()+body.minutes*60000).toISOString(),revision:0,currentQuestionId:questions[0].id,questions};await save(session);return view(session);
    },
    draft(body){return exclusive(body.id,async()=>{const session=await get(body.id);active(session);checkRevision(session,body.revision);const q=find(session,body.questionId);
      if(typeof body.code!=='string'||body.code.length>24000||typeof body.casesText!=='string'||body.casesText.length>24000||typeof body.marked!=='boolean')throw new AppError(400,'Provide bounded code, test JSON text and a review flag.');
      if(body.currentQuestionId)find(session,body.currentQuestionId);q.code=body.code;q.casesText=body.casesText;q.marked=body.marked;session.currentQuestionId=body.currentQuestionId||q.id;session.revision++;await save(session);return view(session);
    });},
    examples(body){return exclusive(body.id,async()=>{const session=await get(body.id);active(session);checkRevision(session,body.revision);const q=find(session,body.questionId);let cases;try{cases=JSON.parse(q.casesText);}catch{throw new AppError(400,'Enter valid JSON cases before running.');}
      const report=await judge(q,q.code,cases);q.exampleRun={...report,starterCode:q.starterCode,code:q.code,casesText:q.casesText};session.revision++;await save(session);return view(session);
    });},
    finish(body){return exclusive(body.id,async()=>{const session=await get(body.id);if(session.status==='finished')return {...view(session),cached:true};checkRevision(session,body.revision);
      if(session.status==='active'){session.status='grading';session.submittedAt=stamp();session.finishReason=expired(session)?'time_expired':'submitted';session.revision++;await save(session);}
      session.gradingError=null;
      try{for(const q of session.questions){if(q.evaluation)continue;
        try{q.evaluation=q.code.trim()&&q.code!==q.starterCode?await judge(q,q.code,q.hidden):{status:'not_submitted',passed:0,total:q.hidden.length,execution:null,firstFailure:null,completedAt:stamp()};}
        catch(error){if(![408,422].includes(error.status))throw error;q.evaluation={status:'execution_failed',passed:0,total:q.hidden.length,execution:null,error:error.message,firstFailure:null,completedAt:stamp()};}await save(session);
      }}catch(error){session.gradingError=error.status?error.message:'Grading did not finish. Retry grading the saved submission.';await save(session);throw error;}
      session.status='finished';session.finishedAt=stamp();session.revision++;
      session.summary={questions:session.questions.length,solved:session.questions.filter(q=>q.evaluation.status==='completed'&&q.evaluation.passed===q.evaluation.total).length,passed:session.questions.reduce((sum,q)=>sum+q.evaluation.passed,0),total:session.questions.reduce((sum,q)=>sum+q.evaluation.total,0),notSubmitted:session.questions.filter(q=>q.evaluation.status==='not_submitted').length,executedCases:session.questions.filter(q=>q.evaluation.status==='completed').reduce((sum,q)=>sum+q.evaluation.total,0),generatedQuestions:session.questions.filter(q=>q.kind==='generated').length};await save(session);return {...view(session),cached:false};
    });}
  };
}
