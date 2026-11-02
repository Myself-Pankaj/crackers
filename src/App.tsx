import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { collection, deleteDoc, doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore'
import { auth, db, configured, firebaseProjectId, firestoreDatabaseId } from './firebase'
import { calculate, categories as defaultCategories, money } from './model'
import type { Bill, CartLine, Product } from './model'
import { Icon, ProductArt } from './icons'
import { firebaseErrorMessage } from './firebaseErrors'
import { prepareProductImage } from './productImage'
import { normalizePhone } from './phone'
import { emptyProductDraft, productToDraft, parseProductDraft } from './stockForm'
import type { ProductDraft } from './stockForm'
import { STORE_NAME, DIWALI_WISH } from './brand'
import { categoryId, cleanCategoryName, mergeCategories } from './categories'
import { uploadBillPdf } from './billUpload'
import { PdfLinkSaveError } from './pdfPublication'
import { billShareData, billShareUrl, shareBillMessage } from './billSharing'
import { pdfSmsUrl } from './sms'
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
 const [reviewing, setReviewing] = useState(false)
 const catalogScroll = useRef(0)
 const reviewButton = useRef<HTMLButtonElement>(null)
 const pageTitle = useRef<HTMLHeadingElement>(null)
 function openReview() {
   catalogScroll.current = window.scrollY
   setReviewing(true)
   requestAnimationFrame(() => { window.scrollTo(0, 0); pageTitle.current?.focus() })
 }
 function closeReview() {
   setReviewing(false)
   requestAnimationFrame(() => { window.scrollTo(0, catalogScroll.current); (reviewButton.current || pageTitle.current)?.focus({ preventScroll: true }) })
 }
 function navigate(next: string) {
   if (next === tab) return
   setTab(next); setSearch(''); setCategory('All items')
   requestAnimationFrame(() => { window.scrollTo(0, 0); pageTitle.current?.focus() })
 }
 const [category, setCategory] = useState('All items')
 const [search, setSearch] = useState('')
 const [customer, setCustomer] = useState('')
 const [phone, setPhone] = useState('')
 const [countryCode, setCountryCode] = useState('91')
 const [discount, setDiscount] = useState('')
 const [payment, setPayment] = useState('Paid · Cash')
 const [modal, setModal] = useState<'product' | 'login' | 'category' | 'account' | null>(null)
 const [editing, setEditing] = useState<Product | null>(null)
 const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft)
 const [customCategories, setCustomCategories] = useState<string[]>([])
 const [categoryName, setCategoryName] = useState('')
 const [returnToProduct, setReturnToProduct] = useState(false)
 const [imageBusy, setImageBusy] = useState(false)
 const [receipt, setReceipt] = useState<Bill | null>(null)
 const [error, setError] = useState('')
 const [pdfBusy, setPdfBusy] = useState(false)
 const [pdfError, setPdfError] = useState('')
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
   setCart([]); setReviewing(false); setReceipt(null); setCustomer(''); setPhone(''); setCountryCode('91'); setDiscount(''); setPayment('Paid · Cash'); setError('')
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
   if (receipt && user && !billShareUrl(receipt, window.location.origin)) void preparePdf(receipt)
 }, [receipt?.id, user?.uid])
 useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer) }, [notice])
 useEffect(() => {
   if (!modal && !receipt) return
   const previous = document.activeElement as HTMLElement | null
   const dialog = document.querySelector<HTMLElement>('[role=dialog]')
   const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), summary') || []).filter(element => element.getClientRects().length > 0)
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
   return () => { document.removeEventListener('keydown', close); document.body.style.overflow = overflow; (previous?.isConnected ? previous : pageTitle.current)?.focus({ preventScroll: true }) }
 }, [modal, receipt?.id, imageBusy, returnToProduct])
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
     setReviewing(false); catalogScroll.current = 0; window.scrollTo(0, 0); setReceipt(bill); setPdfError(''); setCart([]); setCustomer(''); setPhone(''); setCountryCode('91'); setDiscount(''); setPayment('Paid · Cash')
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
     setModal(null); setNotice('Stock item saved.')
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
     setNotice('Signed in to your store.')
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
 async function preparePdf(bill: Bill) {
   if (pdfLock.current || !user) return
   pdfLock.current = true; setPdfBusy(true); setPdfError('')
   try {
     const link = await uploadBillPdf(bill, user.uid)
     setReceipt(current => current?.id === bill.id ? { ...current, ...link } : current)
   } catch (e) {
     if (e instanceof PdfLinkSaveError) {
       setReceipt(current => current?.id === bill.id ? { ...current, ...e.link } : current)
       setPdfError('Your bill link is ready to share, but could not be saved to history yet.')
     } else setPdfError('Could not prepare the bill link. Check your connection and tap either share option to retry.')
   }
   finally { pdfLock.current = false; setPdfBusy(false) }
 }
 async function deleteProduct(product: Product) {
   if (lock.current || busy || pdfBusy) return
   if (!db || !user) { setError('Sign in before deleting stock.'); return }
   const inCart = cart.some(line => line.productId === product.id)
   if (!window.confirm(`Delete “${product.name}” from stock?${inCart ? '\nIt will also be removed from your current bill and the discount will be cleared.' : ''}\nSaved bills will stay unchanged.`)) return
   lock.current = true; setBusy(true); setError('')
   try {
     await deleteDoc(doc(db, 'stores', storeId, 'products', product.id))
     setCart(current => current.filter(line => line.productId !== product.id))
     if (inCart) setDiscount('')
     setProducts(current => current.filter(item => item.id !== product.id))
     setNotice('Stock item deleted.')
   } catch (error) { setError(firebaseErrorMessage(error)) }
   finally { lock.current = false; setBusy(false) }
 }
 const firestoreUrl = `https://console.firebase.google.com/project/${encodeURIComponent(firebaseProjectId)}/firestore/databases/${encodeURIComponent(firestoreDatabaseId)}/data/~2Fstores~2F${encodeURIComponent(storeId)}~2Fproducts`
 const receiptLink = receipt ? billShareUrl(receipt, window.location.origin) : ''
 const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
 function readyToShare(): boolean {
   if (receiptLink) return true
   if (receipt && !pdfBusy) {
     if (!user) setPdfError('Sign in to prepare this bill’s sharing link.')
     else void preparePdf(receipt)
   }
   return false
 }
 function shareBySms() {
   if (!receipt || !readyToShare()) return
   let smsUrl: string
   try { smsUrl = pdfSmsUrl(receipt, receiptLink, ios) }
   catch { smsUrl = pdfSmsUrl({ ...receipt, phone: '' }, receiptLink, ios) }
   window.location.href = smsUrl
 }
 async function shareByApp() {
   if (!receipt || !readyToShare()) return
   try {
     const result = await shareBillMessage(billShareData(receipt, receiptLink), navigator)
     if (result === 'copied') setNotice('Greeting and bill link copied. Paste them into the app you choose.')
   } catch { setNotice('Could not open sharing. Try again in your phone’s browser, or use SMS.') }
 }
 const filteredBills = bills.filter(b => `${b.id} ${b.customer}`.toLowerCase().includes(search.toLowerCase()))
 const todayBills = bills.filter(b => new Date(b.createdAt).toLocaleDateString('en-IN') === new Date().toLocaleDateString('en-IN'))
 return <div className="app-shell">
   <header className="app-header" inert={!!modal || !!receipt}>
     <a className="brand" aria-label={STORE_NAME} href="#" onClick={e => { e.preventDefault(); navigate('Billing') }}><span className="brand-icon"><Icon name="spark" size={23}/></span><span className="brand-wordmark">Hari Om<small>PHATAKA CENTER</small></span></a>
     <button className="account-button secondary" aria-label="Open store account" onClick={() => { setError(''); setModal('account') }}><span className={`status-dot ${user ? 'online' : ''}`}/>{user ? 'Account' : 'Sign in'}</button>
   </header>
   <main inert={!!modal || !!receipt} className={`main ${tab === 'Billing' && cart.length && !reviewing ? 'has-review-bar' : ''}`}>
     <div className="page-content"><section className="page-heading"><div>{tab === 'Billing' && reviewing && <button className="back-button" onClick={closeReview}><span aria-hidden="true">←</span> Back to products</button>}<h1 ref={pageTitle} tabIndex={-1}>{tab === 'Billing' ? reviewing ? 'Review bill' : 'New bill' : tab === 'Inventory' ? 'Stock' : 'Bill history'}</h1><p>{tab === 'Billing' ? reviewing ? 'Check items and payment before generating.' : 'Add boxes or loose pieces to your bill.' : tab === 'Inventory' ? 'Manage items, prices, and available pieces.' : 'Find and share your saved bills.'}</p></div>{tab === 'Inventory' && <button className="secondary add-stock" disabled={busy || pdfBusy} onClick={() => openProduct()}><Icon name="plus" size={18}/> Add stock</button>}</section>
     {!user && <div className="sign-in-prompt"><span>{!configured ? 'Store connection unavailable.' : !authReady ? 'Checking sign-in…' : 'Sign in to manage stock and create bills.'}</span><button className="text-button" disabled={!authReady || !configured} onClick={openLogin}>Sign in</button></div>}
     {error && !modal && <div role="alert" className="error">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}
     {tab !== 'Bill history' ? <div className={tab === 'Billing' ? 'billing-layout' : 'inventory-layout'}><section className="catalog" hidden={tab === 'Billing' && reviewing}>
       <div className="catalog-top"><h2>{tab === 'Billing' ? 'Choose your crackers' : 'All stock'}</h2><div className="view-label">{loading ? 'Loading stock…' : `${products.length} products`}</div></div>
       <div className="search"><Icon name="search" size={19}/><input aria-label="Search crackers" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Clear search" onClick={() => setSearch('')}><Icon name="close" size={16}/></button>}</div>
       <div className="categories">{categories.map(c => <button key={c} className={category === c ? 'selected' : ''} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}<button className="new-category" disabled={!user || busy} onClick={() => openCategory()}><Icon name="plus" size={12}/> Add category</button></div>
       <div className="product-grid">{filtered.map(p => <ProductCard key={p.id} product={p} remaining={Math.max(0, p.stock - used(p.id))} inventory={tab === 'Inventory'} onAdd={unit => add(p, unit)} onEdit={() => openProduct(p)} onDelete={() => void deleteProduct(p)} deleteDisabled={!user || busy || pdfBusy}/>)}</div>
       {!filtered.length && <div className="empty-state"><Icon name="box" size={38}/><h3>{loading ? 'Loading your stock…' : search || category !== 'All items' ? 'No matching crackers' : 'Your shelves are ready'}</h3><p>{search || category !== 'All items' ? 'Try another search or category.' : 'Add your first item to start making bills.'}</p>{!search && category === 'All items' && !loading && <button className="primary" onClick={() => openProduct()}>Add your first item</button>}</div>}
       <div className="catalog-foot"><Icon name="box" size={15}/><span>Box or chillar? You choose. Stock stays in sync.</span><span className="foot-spark">✦</span></div>
     </section>
     {tab === 'Billing' && reviewing && <section className="bill-panel" aria-label="Current bill"><div className="bill-heading"><div className="bill-title"><span className="receipt-icon"><Icon name="bill"/></span><h2>Current bill</h2></div><span className="bill-badge">DRAFT</span></div>
       <div className="customer-section"><label htmlFor="customer">Customer details <span>Optional</span></label><input id="customer" value={customer} onChange={e => setCustomer(e.target.value)} aria-label="Customer name" placeholder="Customer name" autoComplete="name"/><div className="phone-input"><Icon name="phone" size={15}/><span className="country-plus">+</span><input className="country-code" aria-label="Country calling code" type="tel" inputMode="numeric" maxLength={3} value={countryCode} onChange={e => setCountryCode(e.target.value.replace(/\D/g, ''))}/><input aria-label="Customer phone number" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Phone number" value={phone} onChange={e => setPhone(e.target.value)}/></div></div>
       <div className="cart-label"><span>ITEMS <b>({cart.reduce((s, l) => s + l.quantity, 0)})</b></span>{cart.length > 0 && <button onClick={() => setCart([])}>Clear all</button>}</div>
       <div className="cart-items">{!cart.length ? <div className="empty-cart"><span className="empty-cart-art"><Icon name="bill" size={34}/><span>+</span></span><h3>A celebration in the making</h3><p>Add items from the catalogue<br/>to start building your bill.</p></div> : cart.map((line, index) => { const p = products.find(p => p.id === line.productId); return <div className="cart-item" key={`${line.productId}-${line.unit}`}><div><strong>{p?.name || 'Unavailable item'}</strong><small>{line.unit === 'box' ? `Box · ${p?.piecesPerBox} pcs` : 'Chillar · loose piece'} <span>× {money(p ? line.unit === 'box' ? p.boxPrice : p.loosePrice : 0)}</span></small><div className="quantity"><button aria-label={`Reduce ${p?.name} ${line.unit}`} onClick={() => changeQty(index, -1)}>−</button><span>{line.quantity}</span><button aria-label={`Increase ${p?.name} ${line.unit}`} onClick={() => changeQty(index, 1)}>+</button></div></div><div className="cart-item-right"><strong>{money((p ? line.unit === 'box' ? p.boxPrice : p.loosePrice : 0) * line.quantity)}</strong><button aria-label={`Remove ${p?.name} ${line.unit}`} onClick={() => setCart(cart.filter((_, i) => i !== index))}><Icon name="trash" size={15}/></button></div></div> })}</div>
       <div className="totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><label htmlFor="discount">Discount <span className="muted">(₹)</span></label><input id="discount" type="number" min="0" max={subtotal} step="0.01" inputMode="decimal" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)}/></div><div className="total"><span>Total amount</span><strong>{money(total)}</strong></div></div>
       <div className="payment"><label htmlFor="payment">Payment status</label><select id="payment" value={payment} onChange={e => setPayment(e.target.value)}><option>Unpaid</option><option>Paid · Cash</option><option>Paid · UPI</option><option>Paid · Card</option></select></div>
       <button className="primary generate" disabled={!user || !cart.length || busy || loading} onClick={generate}><Icon name="bill" size={18}/>{busy ? 'Generating…' : 'Generate bill'}<Icon name="arrow" size={18}/></button><p className="whatsapp-hint"><span>◉</span> Generate, then share your bill</p>
     </section>}</div> : <section className="history"><div className="stats"><div><span>Bills today</span><strong>{todayBills.length}</strong></div><div><span>Total billed today</span><strong>{money(todayBills.reduce((s, b) => s + b.total, 0))}</strong></div><div><span>All bills</span><strong>{bills.length}</strong></div></div><div className="search"><Icon name="search"/><input aria-label="Search bills" placeholder="Search by customer or bill number…" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="bill-list">{filteredBills.map(b => <button className="history-row" key={b.id} onClick={() => { setPdfError(''); setReceipt(b) }}><span className="receipt-icon"><Icon name="bill"/></span><span><strong>{b.customer || 'Walk-in customer'}</strong><small>{b.id} · {new Date(b.createdAt).toLocaleString('en-IN')}{b.demo ? ' · DEMO' : ''}</small></span><span className="history-total">{money(b.total)}<small>{b.payment}</small></span><Icon name="arrow" size={17}/></button>)}</div>{bills.length > 0 && !filteredBills.length && <div className="empty-state"><Icon name="search" size={38}/><h3>No matching bills</h3><p>Try another customer name or bill number.</p><button className="secondary" onClick={() => setSearch('')}>Clear search</button></div>}{!bills.length && <div className="empty-state"><Icon name="history" size={38}/><h3>Your story starts with the first bill</h3><p>Generated bills will be saved here.</p><button className="primary" onClick={() => navigate('Billing')}>Create a bill</button></div>}</section>}
     </div>
   </main>
   {tab === 'Billing' && !reviewing && cart.length > 0 && <div className="review-bar" inert={!!modal || !!receipt}><button ref={reviewButton} className="primary" onClick={openReview}><span><strong>{cart.reduce((sum, line) => sum + line.quantity, 0)} items · {money(total)}</strong><small>Review bill</small></span><Icon name="arrow" size={22}/></button></div>}
   <nav inert={!!modal || !!receipt} className="bottom-nav" aria-label="Main navigation">{['Billing', 'Inventory', 'Bill history'].map((item, i) => <button key={item} aria-current={tab === item ? 'page' : undefined} className={tab === item ? 'nav-item active' : 'nav-item'} onClick={() => navigate(item)}><Icon name={['bill', 'box', 'history'][i]} size={23}/><span>{['Billing', 'Stock', 'History'][i]}</span></button>)}</nav>
   {notice && <div role="status" className="toast"><Icon name="check" size={18}/>{notice}</div>}
   {modal && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" disabled={busy || imageBusy} onClick={() => { pendingStock.current = false; setModal(modal === 'category' && returnToProduct ? 'product' : null) }}><Icon name="close"/></button><span className="modal-symbol"><Icon name={modal === 'login' ? 'spark' : 'box'} size={28}/></span><h2 id="modal-title">{modal === 'account' ? 'Store account' : modal === 'login' ? 'Sign in to your store' : modal === 'category' ? 'Add a category' : editing ? 'Edit stock item' : 'Add stock item'}</h2><p>{modal === 'account' ? 'Your store and connection details.' : modal === 'login' ? 'Enter your store email and password.' : modal === 'category' ? 'Group your crackers in a way that works for your shop.' : 'Stock is counted in pieces. A box uses the box size below.'}</p>
   {error && <div role="alert" className="error">{error}</div>}
   {modal === 'account' ? <div className="account-details"><p><strong>{STORE_NAME}</strong><span>{user?.email || 'Not signed in'}</span></p><p className="connection-detail">{!configured ? 'Store connection is not configured.' : !authReady ? 'Checking sign-in…' : user ? 'Connected to your online store' : 'Sign in to access your stock and bills.'}</p>{user && <details><summary>Store connection details</summary><p>{firebaseProjectId} · {firestoreDatabaseId}</p><a className="secondary" href={firestoreUrl} target="_blank" rel="noreferrer">View in Firebase ↗</a></details>}<button className="primary" disabled={busy || pdfBusy || !authReady || !configured} onClick={() => { if (user) { setModal(null); void logout() } else openLogin() }}>{user ? 'Sign out' : 'Sign in'}</button></div> : modal === 'login' ? <form onSubmit={login}><label>Email<input autoFocus type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/></label><details className="form-note"><summary>Need a store account?</summary><p>Create a user in Firebase Console → Authentication → Users, with Email/Password sign-in enabled.</p></details><button className="primary" disabled={busy || !configured}>{busy ? 'Signing in…' : 'Sign in'}<Icon name="arrow" size={18}/></button></form> : modal === 'category' ? <form onSubmit={saveCategory}><label>Category name<input autoFocus required maxLength={50} placeholder="e.g. Fancy fireworks" value={categoryName} onChange={e => setCategoryName(e.target.value)} disabled={busy}/></label><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Add category'}<Icon name="plus" size={18}/></button></form> : <form onSubmit={saveProduct}><label>Item name<input autoFocus required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Electric Sparklers"/></label><label>Product image <span className="muted">(optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || imageBusy} onChange={async e => {
 const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
 setImageBusy(true); setError('')
 try { const imageData = await prepareProductImage(file); setDraft(current => ({ ...current, imageData })) }
 catch (e) { setError(e instanceof Error ? e.message : 'Could not load image.') }
 finally { setImageBusy(false) }
 }}/></label>{imageBusy && <p role="status" className="form-note">Preparing image…</p>}{draft.imageData && <div className="image-preview"><img src={draft.imageData} alt="Selected product preview"/><button type="button" className="secondary" disabled={busy || imageBusy} onClick={() => setDraft({ ...draft, imageData: '' })}><Icon name="trash" size={15}/>Remove image</button></div>}<label>Category<select value={draft.category} onChange={e => e.target.value === '__add_category__' ? openCategory(true) : setDraft({ ...draft, category: e.target.value })}>{categories.slice(1).map(c => <option key={c}>{c}</option>)}<option value="__add_category__">+ Add a new category…</option></select></label><div className="form-grid"><label>Pieces per box<input type="number" inputMode="numeric" min="1" step="1" required placeholder="0" value={draft.piecesPerBox} onChange={e => setDraft({ ...draft, piecesPerBox: e.target.value })}/></label><label>Total stock (pieces)<input type="number" inputMode="numeric" min="0" step="1" required placeholder="0" value={draft.stock} onChange={e => setDraft({ ...draft, stock: e.target.value })}/></label><label>Box price (₹)<input type="number" inputMode="decimal" min="0" step="0.01" required placeholder="0" value={draft.boxPrice} onChange={e => setDraft({ ...draft, boxPrice: e.target.value })}/></label><label>Loose piece price (₹)<input type="number" inputMode="decimal" min="0" step="0.01" required placeholder="0" value={draft.loosePrice} onChange={e => setDraft({ ...draft, loosePrice: e.target.value })}/></label></div><button className="primary" disabled={busy || imageBusy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add to stock'}<Icon name="plus" size={18}/></button></form>}</section></div>}
   {receipt && <div className="modal-backdrop receipt-backdrop"><section className="modal receipt" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><button className="modal-close" aria-label="Close bill" disabled={pdfBusy} onClick={() => setReceipt(null)}><Icon name="close"/></button><div className="receipt-festive-header"><span className="festive-star left">✧</span><Icon name="spark" size={30}/><div className="receipt-brand">Hari Om<small>PHATAKA CENTER</small></div><span className="festive-star right">✧</span><p>Lighting up your celebrations</p></div><h2 id="receipt-title">{receipt.demo ? 'Demo bill generated' : 'Your bill is ready'}</h2><p className="receipt-meta">{receipt.id}<br/>{new Date(receipt.createdAt).toLocaleString('en-IN')}</p><div className="receipt-customer">{receipt.customer || 'Walk-in customer'}{receipt.phone && <small>+{receipt.phone}</small>}</div><div className="receipt-lines">{receipt.lines.map(l => <div key={`${l.productId}-${l.unit}`}><span>{l.name}<small>{l.quantity} {l.unit === 'box' ? 'box' : 'piece'} × {money(l.price)}</small></span><strong>{money(l.amount)}</strong></div>)}</div><div className="totals"><div><span>Subtotal</span><strong>{money(receipt.subtotal)}</strong></div><div><span>Discount</span><strong>−{money(receipt.discount)}</strong></div><div className="total"><span>Total</span><strong>{money(receipt.total)}</strong></div><div><span>Payment</span><strong>{receipt.payment}</strong></div></div><div className="diwali-wish" aria-label={DIWALI_WISH}><span aria-hidden="true">✧</span><p>Wishing you and your family<strong>Happy Diwali!</strong></p><span aria-hidden="true">✧</span></div><p className="receipt-thanks">Thank you for celebrating with {STORE_NAME}.</p><div className="receipt-actions"><h3>Share bill</h3>{pdfBusy && <p role="status">Preparing your bill link…</p>}{pdfError && !pdfBusy && <p className="upload-error" role="alert">{pdfError}</p>}<button className="primary" disabled={pdfBusy} onClick={shareBySms}><Icon name="phone" size={18}/> Share via SMS</button><button className="secondary" disabled={pdfBusy} onClick={() => void shareByApp()}><Icon name="share" size={18}/> Share via another app</button><p>Both options include a greeting and your bill link. Choose an app and recipient before sending.</p></div></section></div>}
 </div>
}
function ProductCard({ product: p, remaining, inventory, onAdd, onEdit, onDelete, deleteDisabled }: { product: Product; remaining: number; inventory: boolean; onAdd: (unit: 'box' | 'loose') => void; onEdit: () => void; onDelete: () => void; deleteDisabled: boolean }) {
 return <article className={`product-card ${p.stock === 0 ? 'sold-out' : ''}`}>
   <div className="product-visual">{p.imageData ? <img className="product-photo" src={p.imageData} alt={p.name} loading="lazy"/> : <ProductArt category={p.category} color={p.color}/>}
     <span className={`stock-pill ${p.stock === 0 ? 'out' : p.stock < p.piecesPerBox * 6 ? 'low' : ''}`}><i/>{p.stock === 0 ? 'Out of stock' : p.stock < p.piecesPerBox * 6 ? 'Low stock' : 'In stock'}</span>
   </div>
   <div className="product-info"><span className="product-category">{p.category}</span><h3>{p.name}</h3><p>{p.piecesPerBox} {p.piecesPerBox === 1 ? 'piece' : 'pieces'} / box <span>·</span> {remaining} pieces left</p>
     {inventory ? <div className="product-bottom"><div className="price">{money(p.boxPrice)}<small>/ box</small></div><button className="add-item" disabled={deleteDisabled} aria-label={`Edit ${p.name}`} onClick={onEdit}>Edit</button><button className="delete-item" disabled={deleteDisabled} aria-label={`Delete ${p.name}`} onClick={onDelete}><Icon name="trash" size={16}/> Delete</button></div> : <div className="sale-options">
       <div><span><strong>Box</strong><small>{money(p.boxPrice)} / box</small></span><button className="add-item" disabled={remaining < p.piecesPerBox} aria-label={`Add ${p.name} box`} onClick={() => onAdd('box')}><Icon name="plus" size={14}/> Box</button></div>
       <div><span><strong>Chillar</strong><small>{money(p.loosePrice)} / piece</small></span><button className="add-item" disabled={remaining < 1} aria-label={`Add ${p.name} loose`} onClick={() => onAdd('loose')}><Icon name="plus" size={14}/> Piece</button></div>
     </div>}
   </div>
 </article>
}
export default App
