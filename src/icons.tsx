export function Icon({ name, size = 20 }: { name: string; size?: number }) {
 const paths: Record<string, React.ReactNode> = {
 spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z"/></>,
 bill: <><path d="M6 3h12v19l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
 box: <><path d="m3 7 9-5 9 5v10l-9 5-9-5Z"/><path d="m3 7 9 5 9-5M12 12v10M7.5 4.5l9 5"/></>,
 history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/><path d="M12 7v5l3 2"/></>,
 search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 plus: <path d="M12 5v14M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
 arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>, check: <path d="m5 12 4 4L19 6"/>,
 phone: <><path d="M4 3h4l2 5-3 2a15 15 0 0 0 7 7l2-3 5 2v4c-9 3-20-8-17-17Z"/></>,
 print: <><path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v8H7Z"/><path d="M17 11h1"/></>,
 trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
 logout: <><path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4"/></>,
 }
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>
}
export function ProductArt({ category, color }: { category: string; color: string }) {
 return <div className={`product-art ${color}`}><svg viewBox="0 0 180 110" aria-hidden="true"><ellipse cx="90" cy="97" rx="48" ry="5" fill="currentColor" opacity=".08"/>{category === 'Flower pots' ? <><path d="m66 91 15-49h19l16 49Z" fill="currentColor"/><path d="m80 52 18 34M88 48l17 35" stroke="white" strokeWidth="3" opacity=".5"/><path d="m90 36-3-15m10 16 10-16M80 37 68 24m33 20 19-8" stroke="currentColor" strokeWidth="2"/><path d="m88 10 2-5m25 9 3-3M61 17l-4-3" stroke="currentColor"/></> : category === 'Rockets' ? <><path d="m73 80 27-48 17 10-27 48Z" fill="currentColor"/><path d="m100 32 19-13-2 23Z" fill="currentColor"/><path d="m99 37 13 8m-19 3 13 8" stroke="white" strokeWidth="4"/><path d="m80 82-8 15m20-12-7 13M69 82l-5 3" stroke="currentColor" strokeWidth="2"/><path d="m77 79-11-2 19-14m7 27 11 1-2-22" fill="currentColor"/></> : category === 'Ground chakkars' ? <><ellipse cx="88" cy="73" rx="35" ry="19" fill="currentColor"/><ellipse cx="88" cy="69" rx="35" ry="19" fill="white" opacity=".3"/><ellipse cx="88" cy="68" rx="24" ry="12" fill="none" stroke="currentColor" strokeWidth="6"/><ellipse cx="88" cy="68" rx="10" ry="5" fill="currentColor"/><path d="m119 59 12-13-1-10m0 8 10 3" stroke="currentColor" strokeWidth="2" fill="none"/></> : category === 'Sparklers' ? <><path d="m71 94 28-54m-14 56 21-46M59 89l22-45" stroke="currentColor" strokeWidth="3"/><path d="m99 41 1-19m-7 22-15-8m28 5 14-10m-21 4-12-16m18 17 5-17M81 39l-3-12m-1 16-10-3m15 0 8-8" stroke="currentColor" strokeWidth="2"/><circle cx="100" cy="42" r="4" fill="currentColor"/><path d="m60 20 2 5m59 29 5 1m-4-38 2-3" stroke="currentColor" strokeWidth="2"/></> : <><path d="M58 45h64v47H58Z" fill="currentColor"/><path d="M54 39h72v15H54Z" fill="currentColor"/><path d="M85 39h10v53" fill="white" opacity=".55"/><path d="M56 52h68" stroke="white" strokeWidth="2" opacity=".5"/><path d="M90 39c-34-5-24-28-9-15l9 15c34-5 24-28 9-15Z" stroke="currentColor" strokeWidth="4" fill="none"/><path d="m65 66 4 6 7 1-5 5 1 7-7-3-6 3 1-7-5-5 7-1Z" fill="white" opacity=".6"/></>}</svg></div>
}
