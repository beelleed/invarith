import {useEffect} from 'react';
import {installPaneResizing} from '../pane-resizing.mjs';
export function ResizableWorkspaces(){useEffect(()=>{let storage;try{storage=localStorage;}catch{}return installPaneResizing(document.querySelector('.studio-app'),{storage});},[]);return null;}
