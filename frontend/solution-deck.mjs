export function solutionDeck(lesson){
  return {generated:true,lessonId:lesson.id,lessonVersion:'solution-v1',capturedEvents:0,context:{teacherLed:true,lessonTitle:lesson.title,interviewSummary:lesson.interviewSummary,assumptions:lesson.assumptions,code:'',repairCode:lesson.solutionCode,summary:{call:lesson.problem,expected:'Not executed',actual:'Not executed',status:'unverified'},sourceId:lesson.id,createdAt:lesson.createdAt},frames:lesson.frames};
}
