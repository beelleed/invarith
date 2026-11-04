import {useEffect} from 'react';
import {installSmartEditors} from '../smart-editors.mjs';
export function SmartCodeEditors(){useEffect(()=>installSmartEditors(document.querySelector('.studio-app')),[]);return null;}
