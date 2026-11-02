import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { collection, doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { auth, db, configured, firebaseProjectId, firestoreDatabaseId } from './firebase'
import { calculate, categories as defaultCategories, money } from './model'
import type { Bill, CartLine, Product } from './model'
import { Icon, ProductArt } from './icons'
import { firebaseErrorMessage } from './firebaseErrors'
import { prepareProductImage } from './productImage'
import { loadPdfTools } from './pdfLoader'
import type { PdfTools } from './pdfLoader'
import { normalizePhone } from './phone'
import { emptyProductDraft, productToDraft, parseProductDraft } from './stockForm'
import type { ProductDraft } from './stockForm'
import { STORE_NAME, DIWALI_WISH } from './brand'
import { categoryId, cleanCategoryName, mergeCategories } from './categories'
import { uploadBillPdf } from './billUpload'
import { PdfLinkSaveError } from './pdfPublication'
import { preferredPdfUrl } from './shortUrl'
import { pdfSmsBody, pdfSmsUrl } from './sms'
import './App.css'

function App() {
 const [user, setUser] = useState<User | null>(null)
 const [authReady, setAuthReady] = useState(!auth)
 const [email, setEmail] = useState('')
 const [password, setPassword] = useState('')
 const pendingStock = useRef(false)
 const [products, setProducts] = useState<Product[]>([])
 const [bills, setBills] = useState<Bill[]>([])
 const [cart, setCart] = useState<CartLine[]>([])
 const [tab, setTab] = useState('Billing')
 const [category, setCategory] = useState('All items')
 const [search, setSearch] = useState('')
 const [customer, setCustomer] = useState('')
 const [phone, setPhone] = useState('')
 const [countryCode, setCountryCode] = useState('91')
 const [discount, setDiscount] = useState('')
 const [payment, setPayment] = useState('Paid · Cash')
 const [modal, setModal] = useState<'product' | 'login' | 'category' | null>(null)
 const [editing, setEditing] = useState<Product | null>(null)
 const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft)
 const [customCategories, setCustomCategories] = useState<string[]>([])
 const [categoryName, setCategoryName] = useState('')
 const [returnToProduct, setReturnToProduct] = useState(false)
 const [imageBusy, setImageBusy] = useState(false)
 const [receipt, setReceipt] = useState<Bill | null>(null)
 const [error, setError] = useState('')
 const pdfTools = useRef<PdfTools | null>(null)
 const [pdfReady, setPdfReady] = useState(false)
 const [pdfBusy, setPdfBusy] = useState(false)
 const [pdfError, setPdfError] = useState('')
 const [pdfDiagnostics, setPdfDiagnostics] = useState('')
 const pdfLock = useRef(false)
 const [notice, setNotice] = useState('')
 const [busy, setBusy] = useState(false)
 const [loading, setLoading] = useState(false)
 const lock = useRef(false)
 const storeId = user?.uid || ''
 useEffect(() => {
   if (!auth) return
   return onAuthStateChanged(auth, current => { setUser(current); setAuthReady(true) }, e => { setError(firebaseErrorMessage(e)); setAuthReady(true) })
 }, [])
 useEffect(() => {
   setCart([]); setReceipt(null); setCustomer(''); setPhone(''); setCountryCode('91'); setDiscount(''); setPayment('Paid · Cash'); setError('')
   if (!db || !user) { setProducts([]); setBills([]); setCustomCategories([]); setLoading(false); return }
   setProducts([]); setBills([]); setCustomCategories([]); setLoading(true)
   const failed = (e: Error) => { setError(firebaseErrorMessage(e)); setLoading(false) }
   const stopProducts = onSnapshot(collection(db, 'stores', storeId, 'products'), snapshot => {
     setProducts(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Product))); setLoading(false)
   }, failed)
   const stopBills = onSnapshot(collection(db, 'stores', storeId, 'bills'), snapshot => {
     setBills(snapshot.docs.map(d => d.data() as Bill).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
   }, failed)
   const stopCategories = onSnapshot(collection(db, 'stores', storeId, 'categories'), snapshot => {
     setCustomCategories(snapshot.docs.map(d => d.data().name).filter((name): name is string => typeof name === 'string'))
   }, failed)
   return () => { stopProducts(); stopBills(); stopCategories() }
 }, [user])
 useEffect(() => {
   if (!receipt || pdfTools.current) return
   let cancelled = false
   void loadPdfTools().then(tools => {
     if (!cancelled) { pdfTools.current = tools; setPdfReady(true) }
   }).catch(() => { if (!cancelled) setNotice('PDF tools could not load. Refresh the page and try again.') })
   return () => { cancelled = true }
 }, [receipt?.id])
 useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer) }, [notice])
 useEffect(() => {
   if (!modal && !receipt) return
   const previous = document.activeElement as HTMLElement | null
   const dialog = document.querySelector<HTMLElement>('[role=dialog]')
   const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, select') || [])
   const fields = focusable()
   ;(dialog?.querySelector<HTMLElement>('input') || fields[0])?.focus()
   const close = (e: KeyboardEvent) => {
     if (e.key === 'Escape' && !lock.current && !imageBusy && !pdfLock.current) { pendingStock.current = false; setModal(modal === 'category' && returnToProduct ? 'product' : null); setReceipt(null) }
     if (e.key === 'Tab') {
       const items = focusable(), first = items[0], last = items[items.length - 1]
       if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
       else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
     }
   }
   document.addEventListener('keydown', close)
   const overflow = document.body.style.overflow
   document.body.style.overflow = 'hidden'
   return () => { document.removeEventListener('keydown', close); document.body.style.overflow = overflow; previous?.focus() }
 }, [modal, receipt, imageBusy, returnToProduct])
 const categories = mergeCategories(defaultCategories, customCategories, products.map(p => p.category))
 const filtered = products.filter(p => (category === 'All items' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()))
 const subtotal = cart.reduce((sum, line) => { const p = products.find(p => p.id === line.productId); return sum + (p ? (line.unit === 'box' ? p.boxPrice : p.loosePrice) * line.quantity : 0) }, 0)
 const total = Math.max(0, Math.round((subtotal - (Number(discount) || 0)) * 100) / 100)
 const used = (id: string, items = cart) => items.filter(l => l.productId === id).reduce((sum, l) => sum + l.quantity * (l.unit === 'box' ? products.find(p => p.id === id)!.piecesPerBox : 1), 0)
 function add(p: Product, unit: 'box' | 'loose') {
   const next = cart.some(l => l.productId === p.id && l.unit === unit) ? cart.map(l => l.productId === p.id && l.unit === unit ? { ...l, quantity: l.quantity + 1 } : l) : [...cart, { productId: p.id, unit, quantity: 1 }]
   if (used(p.id, next) > p.stock) { setError(`Not enough stock for another ${unit === 'box' ? 'box' : 'piece'} of ${p.name}.`); return }
   setError(''); setCart(next)
 }
 function changeQty(index: number, delta: number) {
   const next = cart.map((l, i) => i === index ? { ...l, quantity: l.quantity + delta } : l).filter(l => l.quantity > 0)
   const p = products.find(p => p.id === cart[index].productId)
   if (p && used(p.id, next) > p.stock) { setError(`Only ${p.stock} pieces of ${p.name} are available.`); return }
   setError(''); setCart(next)
 }
 async function generate() {
   if (lock.current) return
   lock.current = true; setBusy(true); setError('')
   try {
     if (!db) throw new Error('Firebase is not configured. Bills are saved online only.')
     if (!user) throw new Error('Sign in before generating a bill.')
     const digits = normalizePhone(phone, countryCode)
     const calc = calculate(products, cart, Number(discount) || 0)
     const bill: Bill = { id: `HO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(), customer: customer.trim(), phone: digits, lines: calc.lines, subtotal: calc.subtotal, discount: calc.discount, total: calc.total, payment, demo: false }
     {
       const database = db
       await runTransaction(database, async transaction => {
         const refs = [...calc.required.keys()].map(id => doc(database, 'stores', storeId, 'products', id))
         const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)))
         const current = snapshots.map(s => { if (!s.exists()) throw new Error('An item was removed. Please review your bill.'); return { ...s.data(), id: s.id } as Product })
         const fresh = calculate(current, cart, Number(discount) || 0)
         if (JSON.stringify(fresh.lines) !== JSON.stringify(calc.lines)) throw new Error('Prices or box sizes have changed. Review the updated bill and generate again.')
         for (const p of current) transaction.update(doc(database, 'stores', storeId, 'products', p.id), { stock: p.stock - fresh.required.get(p.id)! })
         transaction.set(doc(database, 'stores', storeId, 'bills', bill.id), bill)
       })
     }
     setReceipt(bill); setPdfError(''); void preparePdf(bill); setCart([]); setCustomer(''); setPhone(''); setCountryCode('91'); setDiscount(''); setPayment('Paid · Cash')
   } catch (e) { setError(firebaseErrorMessage(e)) }
   finally { lock.current = false; setBusy(false) }
 }
 async function saveProduct(e: React.FormEvent) {
   e.preventDefault(); if (lock.current || imageBusy) return
   lock.current = true; setBusy(true); setError('')
   try {
     if (!db) throw new Error('Firebase is not configured. Add the web app values to .env.local and restart Vite. Stock has not been saved.')
     if (!user) throw new Error('Sign in before saving stock and images.')
     const p = parseProductDraft(draft, editing?.id || crypto.randomUUID())
     await setDoc(doc(db, 'stores', storeId, 'products', p.id), p)
     setModal(null); setNotice(`Saved to Firestore: stores/${storeId}/products/${p.id}`)
   } catch (e) { setError(firebaseErrorMessage(e)) }
   finally { lock.current = false; setBusy(false) }
 }
 async function saveCategory(e: React.FormEvent) {
   e.preventDefault()
   if (lock.current) return
   lock.current = true; setBusy(true); setError('')
   try {
     if (!db || !user) throw new Error('Sign in before adding a category.')
     const entered = cleanCategoryName(categoryName)
     const existing = categories.find(c => c.toLowerCase() === entered.toLowerCase())
     const name = existing || entered
     if (!existing) await setDoc(doc(db, 'stores', storeId, 'categories', categoryId(name)), { name })
     setCustomCategories(current => mergeCategories(current, [name]).slice(1))
     if (returnToProduct) setDraft(current => ({ ...current, category: name }))
     setModal(returnToProduct ? 'product' : null)
     setCategoryName(''); setNotice(existing ? 'Category selected.' : `Category “${name}” added.`)
   } catch (e) { setError(firebaseErrorMessage(e)) }
   finally { lock.current = false; setBusy(false) }
 }
 function openCategory(fromProduct = false) {
   setCategoryName(''); setReturnToProduct(fromProduct); setError(''); setModal('category')
 }
 async function login(e: React.FormEvent) {
   e.preventDefault()
   if (!auth || lock.current) return
   lock.current = true; setBusy(true); setError('')
   try {
     const result = await signInWithEmailAndPassword(auth, email.trim(), password)
     setUser(result.user); setPassword('')
     setModal(pendingStock.current ? 'product' : null)
     pendingStock.current = false
     setNotice('Signed in. Stock and bills are saved to your Firebase store.')
   } catch (e) { setError(firebaseErrorMessage(e)) }
   finally { lock.current = false; setBusy(false) }
 }
 async function logout() {
   if (!auth || lock.current) return
   try { await signOut(auth); setPassword(''); setNotice('Signed out.') }
   catch (e) { setError(firebaseErrorMessage(e)) }
 }
 function openProduct(p?: Product) {
   if (!configured) { setError('Firebase is not configured. Check your Firebase web configuration and restart Vite.'); return }
   if (!authReady) { setNotice('Checking your sign-in. Please try again in a moment.'); return }
   setEditing(p || null); setDraft(p ? productToDraft(p) : emptyProductDraft); setError('')
   if (!user) { pendingStock.current = true; setModal('login'); return }
   setModal('product')
 }
 function openLogin() { pendingStock.current = false; setError(''); setModal('login') }
 function downloadPdf(bill: Bill) {
   const tools = pdfTools.current
   if (!tools) { setNotice('PDF tools are loading. Please try again in a moment.'); return false }
   try { tools.createBillPdf(bill).save(tools.billPdfName(bill)); return true }
   catch { setNotice('Unable to create the PDF. You can still print the bill.'); return false }
 }
 async function preparePdf(bill: Bill) {
   if (pdfLock.current || !user) return
   pdfLock.current = true; setPdfBusy(true); setPdfError(''); setPdfDiagnostics('')
   try {
     const link = await uploadBillPdf(bill, user.uid)
     setReceipt(current => current?.id === bill.id ? { ...current, ...link } : current)
     if (!link.shortPdfUrl) setNotice('Shortener unavailable. You can send the original PDF link or try shortening it later.')
   } catch (e) {
     if (e instanceof PdfLinkSaveError) {
       setReceipt(current => current?.id === bill.id ? { ...current, ...e.link } : current)
       setPdfError(e.message)
       setPdfDiagnostics(JSON.stringify({
         code: e.saveErrorCode,
         project: firebaseProjectId,
         database: firestoreDatabaseId,
         signedInUid: auth?.currentUser?.uid || null,
         document: `stores/${user.uid}/bills/${bill.id}`,
         changedFields: Object.keys(e.link),
         pdfHost: new URL(e.link.pdfUrl).hostname,
         pdfUrlLength: e.link.pdfUrl.length,
         pdfPath: e.link.pdfPath,
       }, null, 2))
     } else setPdfError(`The bill is saved. Cloudinary PDF upload failed: ${firebaseErrorMessage(e)} Retry the upload below.`)
   }
   finally { pdfLock.current = false; setPdfBusy(false) }
 }
 async function sharePdf(bill: Bill) {
   try {
     const tools = pdfTools.current
     if (!tools) { setNotice('PDF tools are loading. Please try again in a moment.'); return }
     const file = tools.billPdfFile(bill)
     if (navigator.share && navigator.canShare?.({ files: [file] })) {
       await navigator.share({ files: [file] })
     } else {
       if (downloadPdf(bill)) setNotice('PDF downloaded. Attach this document in the customer’s WhatsApp chat.')
     }
   } catch (e) {
     if (e instanceof Error && e.name === 'AbortError') return
     setNotice('File sharing is unavailable. Use Download PDF and attach it in WhatsApp.')
   }
 }
 const firestoreUrl = `https://console.firebase.google.com/project/${encodeURIComponent(firebaseProjectId)}/firestore/databases/${encodeURIComponent(firestoreDatabaseId)}/data/~2Fstores~2F${encodeURIComponent(storeId)}~2Fproducts`
 let receiptSmsUrl = ''
 const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
 if (receipt?.pdfUrl && receipt.phone) { try { receiptSmsUrl = pdfSmsUrl(receipt, preferredPdfUrl(receipt), ios) } catch { /* Legacy bills may have an invalid phone number. */ } }
 const todayBills = bills.filter(b => new Date(b.createdAt).toLocaleDateString('en-IN') === new Date().toLocaleDateString('en-IN'))
 return <div className="app-shell">
   <aside className="sidebar">
     <a className="brand" aria-label={STORE_NAME} href="#" onClick={e => { e.preventDefault(); setTab('Billing') }}><span className="brand-icon"><Icon name="spark" size={25}/></span><span className="brand-wordmark">Hari Om<small>PHATAKA CENTER</small></span></a>
     <div className="workspace-label">YOUR WORKSPACE</div>
     <nav>{['Billing', 'Inventory', 'Bill history'].map((item, i) => <button key={item} className={tab === item ? 'nav-item active' : 'nav-item'} onClick={() => { setTab(item); setSearch(''); setCategory('All items') }}><Icon name={['bill', 'box', 'history'][i]}/>{item}{item === 'Billing' && <span className="nav-dot"/>}</button>)}</nav>
     <div className="sidebar-bottom"><div className="celebration"><Icon name="spark" size={26}/><h3>Light up your<br/>Diwali celebrations.</h3><p>Joy for the whole family.</p><div className="mini-stars">✧ <span>✦</span> ✧</div></div>
     <button className="connection" disabled={busy || pdfBusy || !authReady} onClick={() => user ? void logout() : openLogin()}><span className={`status-dot ${user ? 'online' : ''}`}/><span>{!authReady ? 'Checking sign-in…' : user ? 'Signed in to Firebase' : 'Sign in to your store'}<small>{user ? 'Sign out →' : 'Email & password →'}</small></span></button>
     <div className="profile"><span className="avatar">{user?.email?.slice(0, 1).toUpperCase() || 'H'}</span><span>{STORE_NAME}<small>{user?.email || 'Not signed in'}</small></span><span className="profile-dots">···</span></div></div>
   </aside>
   <main className="main">
     <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{tab}</strong></div><span className="today">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span className="top-avatar">H</span></header>
     <div className="page-content"><section className="page-heading"><div><div className="eyebrow">LET THE CELEBRATIONS BEGIN</div><h1>{tab === 'Billing' ? 'Create a new bill' : tab === 'Inventory' ? 'Your stock, at a glance' : 'Every celebration, recorded'}</h1><p>{tab === 'Billing' ? 'Pick the crackers. Make their celebration brighter.' : tab === 'Inventory' ? 'Manage your items, prices, and available pieces.' : 'Find past bills, print a copy, or share on WhatsApp.'}</p></div><button className="secondary add-stock" onClick={() => openProduct()}><Icon name="plus" size={17}/> Add stock</button></section>
     <div className="demo-banner"><span><Icon name={user ? 'check' : 'spark'} size={16}/>{!configured ? 'Firebase is not configured. Check your Firebase web configuration.' : !authReady ? 'Checking your Firebase sign-in…' : user ? `Firestore: ${firebaseProjectId} · ${firestoreDatabaseId} · stores/${storeId}/products` : 'Sign in to manage your stock, images, and bills.'}</span>{user ? <a className="firestore-link" href={firestoreUrl} target="_blank" rel="noreferrer">View in Firebase ↗</a> : <button disabled={!authReady || !configured} onClick={openLogin}>Sign in <span>↗</span></button>}</div>
     {error && !modal && <div role="alert" className="error">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}
     {tab !== 'Bill history' ? <div className={tab === 'Billing' ? 'billing-layout' : 'inventory-layout'}><section className="catalog">
       <div className="catalog-top"><h2>{tab === 'Billing' ? 'Choose your crackers' : 'All stock'} <span>{products.length} items</span></h2><div className="view-label"><span className="status-dot online"/> {loading ? 'Loading stock…' : 'Stock available'}</div></div>
       <div className="search"><Icon name="search" size={19}/><input aria-label="Search crackers" placeholder="Search for sparklers, rockets, and more…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Clear search" onClick={() => setSearch('')}><Icon name="close" size={16}/></button>}<span className="search-shortcut">⌕</span></div>
       <div className="categories">{categories.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}<button className="new-category" disabled={!user || busy} onClick={() => openCategory()}><Icon name="plus" size={12}/> Add category</button></div>
       <div className="product-grid">{filtered.map(p => <ProductCard key={p.id} product={p} remaining={Math.max(0, p.stock - used(p.id))} inventory={tab === 'Inventory'} onAdd={unit => add(p, unit)} onEdit={() => openProduct(p)}/>)}</div>
       {!filtered.length && <div className="empty-state"><Icon name="box" size={38}/><h3>{loading ? 'Loading your stock…' : search || category !== 'All items' ? 'No matching crackers' : 'Your shelves are ready'}</h3><p>{search || category !== 'All items' ? 'Try another search or category.' : 'Add your first item to start making bills.'}</p>{!search && category === 'All items' && !loading && <button className="primary" onClick={() => openProduct()}>Add your first item</button>}</div>}
       <div className="catalog-foot"><Icon name="box" size={15}/><span>Box or chillar? You choose. Stock stays in sync.</span><span className="foot-spark">✦</span></div>
     </section>
     {tab === 'Billing' && <aside className="bill-panel"><div className="bill-heading"><div className="bill-title"><span className="receipt-icon"><Icon name="bill"/></span><h2>Current bill</h2></div><span className="bill-badge">DRAFT</span></div>
       <div className="customer-section"><label htmlFor="customer">Customer details <span>Optional</span></label><input id="customer" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name"/><div className="phone-input"><Icon name="phone" size={15}/><span className="country-plus">+</span><input className="country-code" aria-label="Country calling code" type="tel" inputMode="numeric" maxLength={3} value={countryCode} onChange={e => setCountryCode(e.target.value.replace(/\D/g, ''))}/><input aria-label="Customer WhatsApp number" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="10-digit WhatsApp number" value={phone} onChange={e => setPhone(e.target.value)}/></div></div>
       <div className="cart-label"><span>ITEMS <b>({cart.reduce((s, l) => s + l.quantity, 0)})</b></span>{cart.length > 0 && <button onClick={() => setCart([])}>Clear all</button>}</div>
       <div className="cart-items">{!cart.length ? <div className="empty-cart"><span className="empty-cart-art"><Icon name="bill" size={34}/><span>+</span></span><h3>A celebration in the making</h3><p>Add items from the catalogue<br/>to start building your bill.</p></div> : cart.map((line, index) => { const p = products.find(p => p.id === line.productId); return <div className="cart-item" key={`${line.productId}-${line.unit}`}><div><strong>{p?.name || 'Unavailable item'}</strong><small>{line.unit === 'box' ? `Box · ${p?.piecesPerBox} pcs` : 'Chillar · loose piece'} <span>× {money(p ? line.unit === 'box' ? p.boxPrice : p.loosePrice : 0)}</span></small><div className="quantity"><button aria-label={`Reduce ${p?.name} ${line.unit}`} onClick={() => changeQty(index, -1)}>−</button><span>{line.quantity}</span><button aria-label={`Increase ${p?.name} ${line.unit}`} onClick={() => changeQty(index, 1)}>+</button></div></div><div className="cart-item-right"><strong>{money((p ? line.unit === 'box' ? p.boxPrice : p.loosePrice : 0) * line.quantity)}</strong><button aria-label={`Remove ${p?.name} ${line.unit}`} onClick={() => setCart(cart.filter((_, i) => i !== index))}><Icon name="trash" size={15}/></button></div></div> })}</div>
       <div className="totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><label htmlFor="discount">Discount <span className="muted">(₹)</span></label><input id="discount" type="number" min="0" max={subtotal} placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)}/></div><div className="total"><span>Total amount</span><strong>{money(total)}</strong></div></div>
       <div className="payment"><label htmlFor="payment">Payment status</label><select id="payment" value={payment} onChange={e => setPayment(e.target.value)}><option>Unpaid</option><option>Paid · Cash</option><option>Paid · UPI</option><option>Paid · Card</option></select></div>
       <button className="primary generate" disabled={!user || !cart.length || busy || loading} onClick={generate}><Icon name="bill" size={18}/>{busy ? 'Generating…' : 'Generate bill'}<Icon name="arrow" size={18}/></button><p className="whatsapp-hint"><span>◉</span> Generate, then share on WhatsApp</p>
     </aside>}</div> : <section className="history"><div className="stats"><div><span>Bills today</span><strong>{todayBills.length}</strong></div><div><span>Total billed today</span><strong>{money(todayBills.reduce((s, b) => s + b.total, 0))}</strong></div><div><span>All bills</span><strong>{bills.length}</strong></div></div><div className="search"><Icon name="search"/><input aria-label="Search bills" placeholder="Search by customer or bill number…" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="bill-list">{bills.filter(b => `${b.id} ${b.customer}`.toLowerCase().includes(search.toLowerCase())).map(b => <button className="history-row" key={b.id} onClick={() => { setPdfError(''); setReceipt(b) }}><span className="receipt-icon"><Icon name="bill"/></span><span><strong>{b.customer || 'Walk-in customer'}</strong><small>{b.id} · {new Date(b.createdAt).toLocaleString('en-IN')}{b.demo ? ' · DEMO' : ''}</small></span><span className="history-total">{money(b.total)}<small>{b.payment}</small></span><Icon name="arrow" size={17}/></button>)}</div>{!bills.length && <div className="empty-state"><Icon name="history" size={38}/><h3>Your story starts with the first bill</h3><p>Generated bills will be saved here.</p><button className="primary" onClick={() => setTab('Billing')}>Create a bill</button></div>}</section>}
     <footer><span>Made for brighter celebrations.</span><span>{STORE_NAME} <span className="coral">✦</span></span></footer></div>
   </main>
   {notice && <div role="status" className="toast"><Icon name="check" size={18}/>{notice}</div>}
   {modal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" disabled={busy || imageBusy} onClick={() => { pendingStock.current = false; setModal(modal === 'category' && returnToProduct ? 'product' : null) }}><Icon name="close"/></button><span className="modal-symbol"><Icon name={modal === 'login' ? 'spark' : 'box'} size={28}/></span><h2 id="modal-title">{modal === 'login' ? 'Sign in to your store' : modal === 'category' ? 'Add a category' : editing ? 'Update stock item' : 'Add a little celebration'}</h2><p>{modal === 'login' ? 'Use the email and password created in Firebase Authentication.' : modal === 'category' ? 'Group your crackers in a way that works for your shop.' : 'Stock is counted in pieces. A box uses the box size below.'}</p>
   {error && <div role="alert" className="error">{error}</div>}
   {modal === 'login' ? <form onSubmit={login}><label>Email<input autoFocus type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label><p className="form-note">Create your store account in Firebase Console → Authentication → Users → Add user. Enable Email/Password under Sign-in method first.</p><button className="primary" disabled={busy || !configured}>{busy ? 'Signing in…' : 'Sign in'}<Icon name="arrow" size={18}/></button></form> : modal === 'category' ? <form onSubmit={saveCategory}><label>Category name<input autoFocus required maxLength={50} placeholder="e.g. Fancy fireworks" value={categoryName} onChange={e => setCategoryName(e.target.value)} disabled={busy}/></label><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Add category'}<Icon name="plus" size={18}/></button></form> : <form onSubmit={saveProduct}><label>Item name<input autoFocus required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Electric Sparklers"/></label><label>Product image <span className="muted">(optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || imageBusy} onChange={async e => {
 const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
 setImageBusy(true); setError('')
 try { const imageData = await prepareProductImage(file); setDraft(current => ({ ...current, imageData })) }
 catch (e) { setError(e instanceof Error ? e.message : 'Could not load image.') }
 finally { setImageBusy(false) }
 }}/></label>{imageBusy && <p role="status" className="form-note">Preparing image…</p>}{draft.imageData && <div className="image-preview"><img src={draft.imageData} alt="Selected product preview"/><button type="button" className="secondary" disabled={busy || imageBusy} onClick={() => setDraft({ ...draft, imageData: '' })}><Icon name="trash" size={15}/>Remove image</button></div>}<label>Category<select value={draft.category} onChange={e => e.target.value === '__add_category__' ? openCategory(true) : setDraft({ ...draft, category: e.target.value })}>{categories.slice(1).map(c => <option key={c}>{c}</option>)}<option value="__add_category__">+ Add a new category…</option></select></label><div className="form-grid"><label>Pieces per box<input type="number" min="1" step="1" required placeholder="0" value={draft.piecesPerBox} onChange={e => setDraft({ ...draft, piecesPerBox: e.target.value })}/></label><label>Total stock (pieces)<input type="number" min="0" step="1" required placeholder="0" value={draft.stock} onChange={e => setDraft({ ...draft, stock: e.target.value })}/></label><label>Box price (₹)<input type="number" min="0" step="0.01" required placeholder="0" value={draft.boxPrice} onChange={e => setDraft({ ...draft, boxPrice: e.target.value })}/></label><label>Loose piece price (₹)<input type="number" min="0" step="0.01" required placeholder="0" value={draft.loosePrice} onChange={e => setDraft({ ...draft, loosePrice: e.target.value })}/></label></div><button className="primary" disabled={busy || imageBusy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add to stock'}<Icon name="plus" size={18}/></button></form>}</section></div>}
   {receipt && <div className="modal-backdrop receipt-backdrop"><section className="modal receipt" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><button className="modal-close" aria-label="Close bill" disabled={pdfBusy} onClick={() => setReceipt(null)}><Icon name="close"/></button><div className="receipt-festive-header"><span className="festive-star left">✧</span><Icon name="spark" size={30}/><div className="receipt-brand">Hari Om<small>PHATAKA CENTER</small></div><span className="festive-star right">✧</span><p>Lighting up your celebrations</p></div><h2 id="receipt-title">{receipt.demo ? 'Demo bill generated' : 'Your bill is ready'}</h2><p className="receipt-meta">{receipt.id}<br/>{new Date(receipt.createdAt).toLocaleString('en-IN')}</p><div className="receipt-customer">{receipt.customer || 'Walk-in customer'}{receipt.phone && <small>+{receipt.phone}</small>}</div><div className="receipt-lines">{receipt.lines.map(l => <div key={`${l.productId}-${l.unit}`}><span>{l.name}<small>{l.quantity} {l.unit === 'box' ? 'box' : 'piece'} × {money(l.price)}</small></span><strong>{money(l.amount)}</strong></div>)}</div><div className="totals"><div><span>Subtotal</span><strong>{money(receipt.subtotal)}</strong></div><div><span>Discount</span><strong>−{money(receipt.discount)}</strong></div><div className="total"><span>Total</span><strong>{money(receipt.total)}</strong></div><div><span>Payment</span><strong>{receipt.payment}</strong></div></div><div className="diwali-wish" aria-label={DIWALI_WISH}><span aria-hidden="true">✧</span><p>Wishing you and your family<strong>Happy Diwali!</strong></p><span aria-hidden="true">✧</span></div><p className="receipt-thanks">Thank you for celebrating with {STORE_NAME}.</p><div className="receipt-actions">{pdfBusy ? <p role="status">{receipt.pdfUrl ? 'Preparing and saving the bill links…' : 'Uploading your PDF to Cloudinary…'}</p> : (!receipt.pdfUrl || pdfError) && <button className="whatsapp-button" onClick={() => void preparePdf(receipt)}><Icon name="bill" size={18}/>{receipt.pdfUrl ? 'Retry saving PDF link' : pdfError ? 'Retry PDF upload' : 'Save PDF to Cloudinary'}</button>}{pdfError && !pdfBusy && <><p className="upload-error" role="alert">{pdfError}</p>{pdfDiagnostics && <details className="save-debug"><summary>Link save error details</summary><pre>{pdfDiagnostics}</pre><button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(pdfDiagnostics); setNotice('Error details copied.') } catch { setNotice('Select and copy the displayed error details.') } }}>Copy error details</button></details>}</>}{receipt.pdfUrl && !receipt.shortPdfUrl && !pdfBusy && !pdfError && <button className="secondary" onClick={() => void preparePdf(receipt)}>Create short PDF link</button>}{receipt.shortPdfUrl && <p className="short-link-preview">Short bill link: <a href={receipt.shortPdfUrl} target="_blank" rel="noreferrer">{receipt.shortPdfUrl}</a></p>}{receiptSmsUrl && <a className="whatsapp-button" href={receiptSmsUrl}><Icon name="phone" size={18}/>Send PDF link by SMS<Icon name="arrow" size={17}/></a>}{receipt.pdfUrl && <><a className="secondary" href={receipt.pdfUrl} target="_blank" rel="noreferrer">Open saved PDF</a><button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(preferredPdfUrl(receipt)); setNotice(receipt.shortPdfUrl ? 'Short PDF link copied.' : 'PDF link copied.') } catch { setNotice('Could not copy. Open the saved PDF to copy its address.') } }}>{receipt.shortPdfUrl ? 'Copy short PDF link' : 'Copy PDF link'}</button>{receipt.phone && <button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(pdfSmsBody(receipt, preferredPdfUrl(receipt))); setNotice('Message copied. Paste it into your phone’s Messages app.') } catch { setNotice('Could not copy the message.') } }}>Copy SMS message</button>}</>}<button className="secondary" onClick={() => void sharePdf(receipt)} disabled={pdfBusy || !pdfReady}><Icon name="phone" size={17}/> Share PDF file</button><button className="secondary" disabled={!pdfReady} onClick={() => downloadPdf(receipt)}><Icon name="bill" size={17}/> Download PDF</button><button className="secondary" onClick={() => window.print()}><Icon name="print" size={17}/> Print bill</button><p>{receiptSmsUrl ? `Opens Messages for +${receipt.phone} with the PDF link. Review and tap Send on your phone.` : receipt.pdfUrl ? 'Add a valid customer phone number when creating a bill to use SMS, or copy this PDF link.' : 'Your bill is already saved. Upload its PDF to get a shareable link.'}</p>{receipt.pdfUrl && <p>Anyone with the PDF link can view this bill. SMS sending uses your phone’s messaging app.</p>}</div></section></div>}
 </div>
}
function ProductCard({ product: p, remaining, inventory, onAdd, onEdit }: { product: Product; remaining: number; inventory: boolean; onAdd: (unit: 'box' | 'loose') => void; onEdit: () => void }) {
 return <article className={`product-card ${p.stock === 0 ? 'sold-out' : ''}`}>
   <div className="product-visual">{p.imageData ? <img className="product-photo" src={p.imageData} alt={p.name} loading="lazy"/> : <ProductArt category={p.category} color={p.color}/>}
     <span className={`stock-pill ${p.stock === 0 ? 'out' : p.stock < p.piecesPerBox * 6 ? 'low' : ''}`}><i/>{p.stock === 0 ? 'Out of stock' : p.stock < p.piecesPerBox * 6 ? 'Low stock' : 'In stock'}</span>{inventory && <button className="edit-product" onClick={onEdit}>Edit</button>}
   </div>
   <div className="product-info"><span className="product-category">{p.category}</span><h3>{p.name}</h3><p>{p.piecesPerBox} {p.piecesPerBox === 1 ? 'piece' : 'pieces'} / box <span>·</span> {remaining} pieces left</p>
     {inventory ? <div className="product-bottom"><div className="price">{money(p.boxPrice)}<small>/ box</small></div><button className="add-item" onClick={onEdit}>Manage</button></div> : <div className="sale-options">
       <div><span><strong>Box</strong><small>{money(p.boxPrice)} / box</small></span><button className="add-item" disabled={remaining < p.piecesPerBox} aria-label={`Add ${p.name} box`} onClick={() => onAdd('box')}><Icon name="plus" size={14}/> Box</button></div>
       <div><span><strong>Chillar</strong><small>{money(p.loosePrice)} / piece</small></span><button className="add-item" disabled={remaining < 1} aria-label={`Add ${p.name} loose`} onClick={() => onAdd('loose')}><Icon name="plus" size={14}/> Piece</button></div>
     </div>}
   </div>
 </article>
}
export default App
