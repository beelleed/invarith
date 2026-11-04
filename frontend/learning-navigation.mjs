const views=new Set(['practice','today','library','topics','review','records','lists','lessons']);
export function learningViewFromUrl(href){
  const url=new URL(href,'http://localhost');const selected=url.searchParams.get('learn');
  if(views.has(selected))return selected;
  return /walkthrough|teacher|lesson/.test(url.hash)?'lessons':'practice';
}
export function learningViewUrl(href,view){
  const url=new URL(href,'http://localhost');url.searchParams.set('learn',views.has(view)?view:'practice');return url.pathname+url.search+url.hash;
}
