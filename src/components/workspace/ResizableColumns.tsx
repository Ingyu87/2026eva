"use client";
import {useEffect, useRef, useState, type ReactNode} from "react";
export function ResizableColumns({showExamples, children, hideIndicators = false}: {showExamples: boolean; children: ReactNode[]; hideIndicators?: boolean}) {
 const [widths,setWidths]=useState([22,44,34]);
 const drag=useRef<{x:number; width:number; values:number[]}|null>(null);
 useEffect(()=>{try {const v=JSON.parse(localStorage.getItem("workspace-columns")??"null");if(Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&n>=12)&&Math.abs(v.reduce((a,b)=>a+b,0)-100)<1)setWidths(v);}catch{}},[]);
 const save=(next:number[])=>{setWidths(next);try{localStorage.setItem("workspace-columns",JSON.stringify(next));}catch{}};
 const resize=(index:number,delta:number,values=widths)=>{const next=[...values];const d=Math.max(12-values[index],Math.min(values[index+1]-12,delta));next[index]+=d;next[index+1]-=d;save(next);};
 const separator=(index:number)=><div key={index} className="ws-resizer" role="separator" aria-label={index===0?"평가지표와 문항검색 너비":"문항검색과 우리학교 너비"} aria-orientation="vertical" aria-valuemin={12} aria-valuemax={widths[index]+widths[index+1]-12} aria-valuenow={Math.round(widths[index])} tabIndex={0}
 onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,width:e.currentTarget.parentElement!.clientWidth,values:widths};}}
 onPointerMove={e=>{if(drag.current)resize(index,(e.clientX-drag.current.x)/drag.current.width*100,drag.current.values);}}
 onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
 onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();resize(index,e.key==="ArrowLeft"?-2:2);}}} onDoubleClick={()=>save([22,44,34])}/>;
 return <main className={showExamples?"ws-grid ws-grid--resizable":"ws-grid ws-grid--edit"} style={showExamples?{gridTemplateColumns:hideIndicators ? `minmax(0, ${widths[1]}fr) 8px minmax(0, ${widths[2]}fr)` : `minmax(0, ${widths[0]}fr) 8px minmax(0, ${widths[1]}fr) 8px minmax(0, ${widths[2]}fr)`}:undefined}>
 {showExamples?<>{!hideIndicators && <>{children[0]}{separator(0)}</>}{children[1]}{separator(1)}{children[2]}</>:children[2]}
 </main>;
}
