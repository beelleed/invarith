import React from 'react';

// Preserve metadata spacing even when small text uses a narrow space glyph.
// Only pass interface metadata here, not learner-authored content.
export function MetaText({children}){
  const parts=String(children).split(' · ');
  return parts.map((part,index)=><React.Fragment key={index}>{index>0&&<span className="learning-meta-separator">{' · '}</span>}{part}</React.Fragment>);
}
