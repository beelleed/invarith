// Only observed counts leave this boundary. Hidden inputs, answers, source and
// invented diagnoses must not become a prompt for the next generated question.
export function practiceLearningEvidence(session){
  const result=session.lastResult;
  if(!result||!['examples','hidden_cases'].includes(result.scope)||!Number.isInteger(result.total)||result.total<1||!Number.isInteger(result.passed)||result.passed<0||result.passed>result.total)return null;
  return {scope:result.scope,passed:result.passed,total:result.total,status:result.passed===result.total?'tested_cases_passed':'observed_failure',interpretation:'Observed test counts only. The learner-selected focus is a preference, not a proven skill deficit.'};
}
