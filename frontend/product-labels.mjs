// User actions describe the outcome. Provider billing belongs in account settings.
export const productCopy={
 'Multiple questions. One timer. Your own reasoning. Start without model credits.':'Multiple questions. One timer. Your own reasoning.',
 'Uses AI credits and sends your problem, code and tests to your model. Review expected values before running.':'Your problem, code and tests are sent for analysis. Review proposed expectations before running.',
 'Uses AI credits and sends your code and test results to your model. Verify suggestions with tests.':'Your code and test results are used to suggest a next step. Verify suggestions with tests.',
 'Uses AI credits. Saved lessons are reused. Check generated code with tests.':'Lessons are saved for later. Check generated code with tests.',
 'Starting is free. Follow-up questions, AI hints and feedback may use credits. Evaluation cases appear after you finish.':'Choose an interviewer and explain your reasoning. Evaluation cases appear after you finish.',
 'Uses AI credits when requested. Review proposals before using them.':'Review proposals before using them.',
 'Runs locally. No AI credits.':'Run the checks and inspect the evidence.',
 'Starting, saving, clarification and calculations use no AI. Follow-ups, coaching hints and the final review use model credits only when requested.':'Clarify the requirements, draw your architecture, and explain your decisions. Ask for follow-ups or finish to review.',
 'Starting uses no model credits. Up to four answered questions; AI selects at most three follow-ups from a reviewed question bank. Coaching allows up to three requested hints. Optional assessment comes after finishing. Each model request caps completion at 1,024 tokens plus prompt tokens. No automatic calls or retries. These are repeatable practice tasks, not a blinded skill assessment.':'Answer up to four interviewer questions. Coaching offers optional hints; strict mode keeps feedback until the end. Finish to review your answers and test evidence.',
 'Creates a new contract, two solution implementations and tests. A question is saved only when the implementations agree on application-generated inputs. One AI request per click; no automatic retries.':'New questions include a function contract, examples and hidden tests. Review the problem before starting.',
 'Prepared question ready. No AI request was made.':'Your practice question is ready.',
 'Another bug version is ready. No AI request was made.':'Another bug version is ready.',
 '{0} topics · Ready questions rotate between supported contracts and prepared bug versions. Test inputs vary. No AI request is needed to open them.':'{0} topics · Practice writing solutions, fixing bugs, or improving performance.',
 'Up to three scenarios per interview. Saving your response uses no AI.':'Try up to three architecture scenarios in each interview.',
 'Prefer a ready question? Start the URL shortener interview above without AI.':'You can also start with the ready URL shortener question above.',
 'Suggestions are based on this attempt, not a diagnosis of your ability. Generated follow-ups are saved so reopening them uses no model credits.':'Suggestions are based on this attempt, not a diagnosis of your ability. Your follow-up questions are saved so you can continue later.',
 'One generation is saved for this interview and page language. Replaying it uses no model credits. This is one possible design, not an official answer.':'Your walkthrough is saved with this interview. It shows one possible design, not an official answer.',
};
const usageSegment=/^(?:no ai(?: credits| to start)?|ai credits|uses model credits|no model credits|no api credits|local docker|不使用\s*AI(?:\s*額度)?|使用\s*AI\s*額度|使用模型額度|開始不花\s*AI\s*額度|開始不花\s*AI|不花\s*AI\s*額度|不花模型額度|本機\s*Docker)$/i;
export function cleanProductLabel(value){return value.split(/\s*[·•]\s*/).filter(part=>!usageSegment.test(part.trim())).join(' · ');}
