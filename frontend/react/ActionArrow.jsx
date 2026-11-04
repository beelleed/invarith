import React from 'react';

export function ActionArrow({external=false}) {
 return <svg className="action-arrow" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={external?'M4 12 12 4M4 4h8v8':'M3 8h10M9 4l4 4-4 4'}/></svg>;
}

export function ChevronDown(){return <svg className="chevron-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg>;}
