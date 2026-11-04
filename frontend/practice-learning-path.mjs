export function practiceLearningStep(result){
  if(!result||!['examples','hidden_cases'].includes(result.scope)||!Number.isInteger(result.total)||result.total<1||!Number.isInteger(result.passed)||result.passed<0||result.passed>result.total)return null;
  if(result.passed<result.total)return {phase:'investigate',title:'Turn this failure into a debugging experiment.',description:'Compare the expected and actual results, write one hypothesis, then change one thing and rerun the same tests.'};
  if(result.scope!=='hidden_cases')return {phase:'submit',title:'Your examples pass. Check the held-back cases next.',description:'Submit this solution before moving on. Public examples alone do not check the hidden cases.'};
  return {phase:'transfer',title:'Explain the idea, then try it in a new situation.',description:'Describe why your approach works, walk through an example, and define time and space complexity. Then choose a concept to practice next.'};
}
