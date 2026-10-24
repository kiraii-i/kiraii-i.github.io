import { CONFIG } from './config.js';

/* ============================== helpers ============================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => `${Number(n || 0).toLocaleString('en-US')} ${CONFIG.currency}`;
const OWNER = CONFIG.ownerEmail.toLowerCase();
const th = a => a.thumb || a.image || '';
const app = $('#app');

let B;                       // backend (firebase or demo)
let user = null;             // { email, owner, admin, verified }
let artworks = [];
let settings = { shippingFee: 60, freeShippingOver: 0 };
let adminTab = 'orders';
let authMode = 'login';
let ordersCache = [];
let editing = null;          // artwork being edited (or {} for new)
let formImage = null;        // new full-size image (data URL) chosen in the form
let formThumb = null;        // its small thumbnail

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2800);
}

const cart = {
  get() { try { return JSON.parse(localStorage.getItem('artshop_cart')) || []; } catch { return []; } },
  set(v) { localStorage.setItem('artshop_cart', JSON.stringify(v)); updateNav(); }
};

function fileToDataUrl(file, max = 1400, limit = 800000) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let size = max, q = .85, out;
      const c = document.createElement('canvas');
      do {
        const r = Math.min(1, size / Math.max(img.width, img.height));
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        q -= .1; size *= .9;
      } while (out.length > limit && q > .3);
      URL.revokeObjectURL(url);
      res(out);
    };
    img.onerror = () => rej(new Error('Could not read this image.'));
    img.src = url;
  });
}

const orderId = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `AS-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

const niceErr = e => {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Wrong email or password.';
  if (c.includes('email-already-in-use')) return 'This email already has an account. Log in instead.';
  if (c.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (c.includes('invalid-email')) return 'That email looks wrong.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Try again in a few minutes.';
  if (c.includes('permission-denied')) return 'Permission denied. Check the Firestore rules (README, step 2).';
  if (e?.name === 'QuotaExceededError') return 'Browser storage is full (demo mode). Use a smaller image or connect Firebase.';
  return e?.message || 'Something went wrong.';
};

/* ============================== backends ============================== */
function demoBackend() {
  const K = 'artshop_demo_';
  const get = (k, d) => { try { const v = localStorage.getItem(K + k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const set = (k, v) => localStorage.setItem(K + k, JSON.stringify(v));
  const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const uid = () => Math.random().toString(36).slice(2, 10);
  let cb = null;
  const mk = email => ({ email, owner: email === OWNER, admin: email === OWNER || get('team', []).includes(email), verified: true });
  const emit = () => { const s = get('session', null); cb && cb(s ? mk(s.email) : null); };
  return {
    demo: true,
    onAuth(f) { cb = f; emit(); },
    async login(email, pw) {
      email = email.toLowerCase();
      const users = get('users', {});
      if (!users[email]) throw new Error('No account with this email yet. Create one first.');
      if (users[email] !== await sha(pw)) throw new Error('Wrong email or password.');
      set('session', { email }); emit();
    },
    async register(email, pw) {
      email = email.toLowerCase();
      const users = get('users', {});
      if (users[email]) throw new Error('This email already has an account. Log in instead.');
      users[email] = await sha(pw); set('users', users);
      set('session', { email }); emit();
    },
    async logout() { set('session', null); emit(); },
    async resend() { },
    async artworks() { return get('artworks', []); },
    async saveArtwork(a, full) {
      const all = get('artworks', []);
      if (!a.id) a.id = uid();
      if (full) set('img_' + a.id, full);
      const i = all.findIndex(x => x.id === a.id);
      if (i >= 0) all[i] = a; else all.push(a);
      set('artworks', all); return a.id;
    },
    async fullImage(id) { return get('img_' + id, null); },
    async reset() { throw new Error('Password reset works once Firebase is connected.'); },
    async deleteArtwork(id) { set('artworks', get('artworks', []).filter(a => a.id !== id)); localStorage.removeItem(K + 'img_' + id); },
    async markSold(id) { set('artworks', get('artworks', []).map(a => a.id === id ? { ...a, originalAvailable: false } : a)); },
    async createOrder(o) { const all = get('orders', []); all.push(o); set('orders', all); },
    async orders() { return get('orders', []).sort((a, b) => b.createdAt - a.createdAt); },
    async updateOrder(id, p) { set('orders', get('orders', []).map(o => o.id === id ? { ...o, ...p } : o)); },
    async team() { return get('team', []); },
    async addTeam(e) { const t = get('team', []); if (!t.includes(e)) t.push(e); set('team', t); },
    async removeTeam(e) { set('team', get('team', []).filter(x => x !== e)); },
    async settings() { return get('settings', null); },
    async saveSettings(s) { set('settings', s); }
  };
}

async function firebaseBackend(cfg) {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js')
  ]);
  const fbApp = initializeApp(cfg);
  const auth = A.getAuth(fbApp);
  const db = F.getFirestore(fbApp);
  const strip = ({ id, ...r }) => r;
  const list = async (name, ...q) => (await F.getDocs(F.query(F.collection(db, name), ...q))).docs.map(d => ({ id: d.id, ...d.data() }));
  return {
    demo: false,
    onAuth(f) {
      A.onAuthStateChanged(auth, async u => {
        if (!u) return f(null);
        const email = (u.email || '').toLowerCase();
        try { await u.reload(); if (u.emailVerified) await u.getIdToken(true); } catch { }
        const verified = u.emailVerified;
        let admin = false;
        if (verified) {
          admin = email === OWNER;
          if (!admin) { try { admin = (await F.getDoc(F.doc(db, 'team', email))).exists(); } catch { } }
        }
        f({ email, owner: email === OWNER, admin, verified });
      });
    },
    login: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    async register(e, p) {
      const c = await A.createUserWithEmailAndPassword(auth, e, p);
      try { await A.sendEmailVerification(c.user); } catch { }
    },
    logout: () => A.signOut(auth),
    async resend() { if (auth.currentUser) await A.sendEmailVerification(auth.currentUser); },
    artworks: () => list('artworks'),
    async saveArtwork(a, full) {
      const ref = a.id ? F.doc(db, 'artworks', a.id) : F.doc(F.collection(db, 'artworks'));
      if (full) await F.setDoc(F.doc(db, 'images', ref.id), { data: full });
      await F.setDoc(ref, strip(a));
      return ref.id;
    },
    async fullImage(id) { const s = await F.getDoc(F.doc(db, 'images', id)); return s.exists() ? s.data().data : null; },
    reset: e => A.sendPasswordResetEmail(auth, e),
    async deleteArtwork(id) { await F.deleteDoc(F.doc(db, 'artworks', id)); try { await F.deleteDoc(F.doc(db, 'images', id)); } catch { } },
    markSold: id => F.updateDoc(F.doc(db, 'artworks', id), { originalAvailable: false }),
    createOrder: o => F.setDoc(F.doc(db, 'orders', o.id), o),
    orders: () => list('orders', F.orderBy('createdAt', 'desc')),
    updateOrder: (id, p) => F.updateDoc(F.doc(db, 'orders', id), p),
    async team() { return (await list('team')).map(t => t.id); },
    addTeam: e => F.setDoc(F.doc(db, 'team', e), { email: e }),
    removeTeam: e => F.deleteDoc(F.doc(db, 'team', e)),
    async settings() { const s = await F.getDoc(F.doc(db, 'settings', 'main')); return s.exists() ? s.data() : null; },
    saveSettings: s => F.setDoc(F.doc(db, 'settings', 'main'), s)
  };
}

/* ============================== email notification ============================== */
function describe(o) {
  const c = o.customer || {};
  const items = o.type === 'custom'
    ? `CUSTOM REQUEST\n${o.custom?.description || ''}\nSize: ${o.custom?.size || '-'}\nMedium: ${o.custom?.medium || '-'}\nBudget: ${o.custom?.budget || '-'}${o.custom?.image ? '\n(reference image: see dashboard)' : ''}`
    : (o.items || []).map(i => `${i.qty}x ${i.title} - ${i.kind === 'original' ? 'ORIGINAL' : 'PRINT'} ${i.size} - ${money(i.price * i.qty)}`).join('\n');
  const isC = o.type === 'custom';
  return {
    title: isC ? 'Custom request' : 'New order',
    name: c.name, phone: c.phone, email: c.email || '-',
    address: [c.address, c.city].filter(Boolean).join(', ') || '-',
    items, notes: c.notes || '-',
    subtotal: isC ? '-' : money(o.subtotal), shipping: isC ? '-' : money(o.shipping), total: isC ? '-' : money(o.total)
  };
}

async function notify(o) {
  const e = CONFIG.emailjs || {};
  const d = describe(o);
  try {
    if (e.serviceId && e.templateId && e.publicKey) {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: e.serviceId, template_id: e.templateId, user_id: e.publicKey,
          template_params: {
            to_email: CONFIG.ownerEmail, order_id: o.id, order_type: d.title,
            customer_name: d.name, customer_phone: d.phone, customer_email: d.email, address: d.address,
            items: d.items, subtotal: d.subtotal, shipping: d.shipping, total: d.total, notes: d.notes
          }
        })
      });
    } else if (CONFIG.formsubmit && !B.demo) {
      // FormSubmit: no sign-up needed (first order sends you a one-time activation email).
      await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(CONFIG.formsubmit), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `artshop - ${d.title} ${o.id}`, _template: 'table', _captcha: 'false',
          ...(d.email !== '-' ? { _replyto: d.email } : {}),
          Order: o.id, Type: d.title, Name: d.name, Phone: d.phone, 'Customer email': d.email, Address: d.address,
          Items: d.items, Subtotal: d.subtotal, Shipping: d.shipping, Total: d.total, Notes: d.notes
        })
      });
    }
  } catch { }
}

/* ============================== cart logic ============================== */
const prints = a => (a.prints || []).filter(p => Number(p.price) > 0);

function cartLines() {
  return cart.get().map(l => {
    const a = artworks.find(x => x.id === l.artId);
    if (!a) return null;
    let price;
    if (l.kind === 'original') {
      if (a.originalAvailable === false || !(a.originalPrice > 0)) return null;
      price = a.originalPrice;
    } else {
      const p = prints(a).find(p => p.size === l.size);
      if (!p) return null;
      price = Number(p.price);
    }
    return { ...l, price, title: a.title, image: th(a) };
  }).filter(Boolean);
}

function totals(lines) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const free = Number(settings.freeShippingOver) > 0 && subtotal >= Number(settings.freeShippingOver);
  const shipping = !lines.length || free ? 0 : Number(settings.shippingFee) || 0;
  return { subtotal, shipping, total: subtotal + shipping };
}

const key = l => `${l.artId}|${l.kind}|${l.size}`;

/* ============================== navigation / router ============================== */
function updateNav() {
  const n = cart.get().reduce((a, i) => a + i.qty, 0);
  const h = location.hash || '#/';
  const a = (href, label, on) => `<a href="${href}" class="${on ? 'on' : ''}">${label}</a>`;
  $('#nav').innerHTML = [
    a('#/', 'Gallery', h === '#/' || h === '#' || h.startsWith('#/art')),
    a('#/custom', 'Custom', h.startsWith('#/custom')),
    user?.admin ? a('#/admin', 'Admin', h.startsWith('#/admin')) : '',
    user ? '<a href="#" id="logout">Logout</a>' : a('#/login', 'Login', h.startsWith('#/login')),
    a('#/cart', `Cart (${n})`, h.startsWith('#/cart') || h.startsWith('#/checkout'))
  ].join('');
}

const head = (crumb, title, sub) =>
  `<p class="crumb">${crumb}</p><h1>${title}</h1>${sub ? `<p class="lead">${sub}</p>` : ''}`;

function route() {
  const parts = (location.hash || '#/').split('/');
  const p = parts[1] || '';
  const arg = parts[2];
  updateNav();
  const views = { '': gallery, art: () => art(arg), custom, login, cart: cartView, checkout, done: () => done(arg), admin };
  (views[p] || gallery)();
}

/* ============================== views: public ============================== */
function card(a) {
  const pr = prints(a);
  const min = pr.length ? Math.min(...pr.map(p => Number(p.price))) : 0;
  const hasOrig = a.originalPrice > 0;
  const sold = hasOrig && a.originalAvailable === false;
  const priceLine = [hasOrig && !sold ? `Original ${money(a.originalPrice)}` : '', min ? `Prints from ${money(min)}` : ''].filter(Boolean).join(' · ');
  return `<a class="card" href="#/art/${esc(a.id)}">
    <div class="thumb"><img loading="lazy" src="${esc(th(a))}" alt="${esc(a.title)}">${sold ? '<span class="badge">ORIGINAL SOLD</span>' : ''}</div>
    <h3>${esc(a.title)}</h3>
    <p class="meta">${esc(a.medium)} · ${esc(a.dimensions)}</p>
    <p class="meta dim">${priceLine}</p></a>`;
}

function gallery() {
  const list = artworks.filter(a => a.published !== false);
  let h = head('ARCHIVE / PORTFOLIO', 'Original works &amp; prints.', 'Every piece, by year. Originals are one of one; prints come in three sizes.');
  if (!list.length) { app.innerHTML = h + '<div class="box">No artworks published yet.</div>'; return; }
  const years = [...new Set(list.map(a => Number(a.year)))].sort((a, b) => b - a);
  h += years.map(y => {
    const items = list.filter(a => Number(a.year) === y);
    return `<section class="year"><div class="yhead"><h2>${y}</h2><span>${String(items.length).padStart(2, '0')} WORK${items.length > 1 ? 'S' : ''}</span></div><div class="grid">${items.map(card).join('')}</div></section>`;
  }).join('');
  app.innerHTML = h;
}

function art(id) {
  const a = artworks.find(x => x.id === id);
  if (!a) { location.hash = '#/'; return; }
  const opts = [];
  if (a.originalPrice > 0) opts.push({ kind: 'original', size: a.dimensions, price: Number(a.originalPrice), ok: a.originalAvailable !== false, label: 'Original' });
  prints(a).forEach(p => opts.push({ kind: 'print', size: p.size, price: Number(p.price), ok: true, label: 'Print' }));
  const first = opts.findIndex(o => o.ok);
  app.innerHTML = `
    <p class="crumb"><a href="#/">← GALLERY</a> / ${esc(a.year)}</p>
    <div class="split">
      <div class="big"><img id="bigimg" src="${esc(th(a))}" alt="${esc(a.title)}"></div>
      <div>
        <h1 class="sm">${esc(a.title)}</h1>
        <dl class="specs">
          <dt>Year</dt><dd>${esc(a.year)}</dd>
          <dt>Medium</dt><dd>${esc(a.medium)}</dd>
          <dt>Size</dt><dd>${esc(a.dimensions)}</dd>
        </dl>
        ${a.description ? `<p class="lead" style="font-size:17px;margin:20px 0 0">${esc(a.description).replace(/\n/g, '<br>')}</p>` : ''}
        <form id="buy">
          <div class="opts">${opts.length ? opts.map((o, i) => `
            <label class="opt ${o.ok ? '' : 'off'}">
              <input type="radio" name="o" value="${i}" ${i === first ? 'checked' : ''} ${o.ok ? '' : 'disabled'}>
              <span><b>${o.label}</b> — ${esc(o.size)}${o.kind === 'original' ? ' · one of one' : ''}</span>
              <em>${o.ok ? money(o.price) : 'SOLD'}</em>
            </label>`).join('') : '<div class="box" style="padding:20px;font-size:15px">Not available right now.</div>'}</div>
          ${first >= 0 ? '<button class="btn">Add to cart</button>' : ''}
        </form>
      </div>
    </div>`;
  if (!a.image) B.fullImage(a.id).then(d => { const im = $('#bigimg'); if (d && im && /^data:image\//.test(d)) im.src = d; }).catch(() => { });
  $('#buy').onsubmit = e => {
    e.preventDefault();
    const sel = new FormData(e.target).get('o');
    if (sel === null) return;
    const o = opts[sel];
    const c = cart.get();
    const line = { artId: a.id, kind: o.kind, size: o.size, qty: 1 };
    const ex = c.find(x => key(x) === key(line));
    if (ex) { if (o.kind === 'print') ex.qty++; } else c.push(line);
    cart.set(c);
    toast('Added to cart');
  };
}

function cartView() {
  const lines = cartLines();
  if (cart.get().length !== lines.length) cart.set(lines.map(({ artId, kind, size, qty }) => ({ artId, kind, size, qty })));
  let h = head('ORDER / CART', 'Your cart.');
  if (!lines.length) { app.innerHTML = h + '<div class="box" style="margin-top:32px">Your cart is empty.</div><p style="margin-top:24px"><a class="btn ghost" href="#/">Browse gallery</a></p>'; return; }
  const t = totals(lines);
  app.innerHTML = h + `<div style="margin-top:36px">${lines.map(l => `
    <div class="line">
      <img src="${esc(l.image)}" alt="">
      <div><h3>${esc(l.title)}</h3><p class="meta">${l.kind === 'original' ? 'Original' : 'Print'} · ${esc(l.size)}</p>
        ${l.kind === 'print' ? `<div class="qty"><button data-act="dec" data-k="${esc(key(l))}">−</button>${l.qty}<button data-act="inc" data-k="${esc(key(l))}">+</button></div>` : ''}
        <p style="margin-top:8px"><a class="meta" href="#" data-act="rm" data-k="${esc(key(l))}">Remove</a></p></div>
      <div class="meta" style="color:var(--text)">${money(l.price * l.qty)}</div>
    </div>`).join('')}</div>
    <div class="sum">
      <div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div><span>Shipping</span><span>${t.shipping ? money(t.shipping) : 'Free'}</span></div>
      <div class="tot"><span>Total</span><span>${money(t.total)}</span></div>
      <p style="margin-top:20px"><a class="btn" style="display:block" href="#/checkout">Checkout</a></p>
    </div>`;
}

function checkout() {
  const lines = cartLines();
  if (!lines.length) { location.hash = '#/cart'; return; }
  const t = totals(lines);
  app.innerHTML = head('ORDER / CHECKOUT', 'Delivery details.', 'Payment is cash on delivery. We confirm your order by phone.') + `
    <form id="co" class="form" style="margin-top:8px">
      <label>Full name<input name="name" required autocomplete="name"></label>
      <div class="row2">
        <label>Phone<input name="phone" type="tel" required autocomplete="tel" placeholder="01xxxxxxxxx"></label>
        <label>Email (optional)<input name="email" type="email" autocomplete="email" value="${esc(user?.email || '')}"></label>
      </div>
      <label>Address<textarea name="address" required style="min-height:90px" placeholder="Street, building, floor, apartment"></textarea></label>
      <label>City / Governorate<input name="city" required></label>
      <label>Notes (optional)<textarea name="notes" style="min-height:70px"></textarea></label>
      <div class="sum" style="margin:0;max-width:none;border:1px solid var(--line);padding:16px;background:var(--panel)">
        ${lines.map(l => `<div><span>${l.qty}× ${esc(l.title)} <span class="dim">(${l.kind === 'original' ? 'Original' : 'Print'} ${esc(l.size)})</span></span><span>${money(l.price * l.qty)}</span></div>`).join('')}
        <div><span>Shipping</span><span>${t.shipping ? money(t.shipping) : 'Free'}</span></div>
        <div class="tot"><span>Total</span><span>${money(t.total)}</span></div>
      </div>
      <p class="err" id="err"></p>
      <button class="btn">Place order</button>
    </form>`;
  $('#co').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = $('button', e.target); btn.disabled = true; btn.textContent = 'Sending…';
    const t2 = totals(lines);
    const order = {
      id: orderId(), type: 'order', status: 'new', createdAt: Date.now(),
      customer: { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(), city: f.city.trim(), notes: f.notes.trim() },
      items: lines.map(({ artId, title, kind, size, price, qty }) => ({ artId, title, kind, size, price, qty })),
      ...t2, payment: 'Cash on delivery'
    };
    try {
      await B.createOrder(order);
      for (const l of lines) if (l.kind === 'original') {
        B.markSold(l.artId).catch(() => { });
        const a = artworks.find(x => x.id === l.artId); if (a) a.originalAvailable = false;
      }
      notify(order);
      cart.set([]);
      sessionStorage.setItem('artshop_last', JSON.stringify(order));
      location.hash = '#/done/' + order.id;
    } catch (err) {
      $('#err').textContent = niceErr(err);
      btn.disabled = false; btn.textContent = 'Place order';
    }
  };
}

function done(id) {
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('artshop_last')); } catch { }
  if (!o || o.id !== id) { location.hash = '#/'; return; }
  const body = o.type === 'custom'
    ? '<p class="lead" style="margin-bottom:0">We received your custom request and will contact you soon to discuss details and price.</p>'
    : `<p class="lead">We received your order and will call you to confirm.</p>
       <div class="sum" style="margin:0"><div><span>Subtotal</span><span>${money(o.subtotal)}</span></div><div><span>Shipping</span><span>${o.shipping ? money(o.shipping) : 'Free'}</span></div><div class="tot"><span>Total</span><span>${money(o.total)}</span></div></div>`;
  app.innerHTML = head('CONFIRMED / THANK YOU', 'Thank you.') + `<p class="meta" style="margin-top:20px">${o.type === 'custom' ? 'REQUEST' : 'ORDER'} № ${esc(o.id)}</p>` + body + '<p style="margin-top:32px"><a class="btn ghost" href="#/">Back to gallery</a></p>';
}

function custom() {
  app.innerHTML = head('COMMISSION / CUSTOM', 'Custom order.', 'Want something made just for you? Tell me what you have in mind and I will get back to you with details and a price.') + `
    <form id="cu" class="form">
      <label>Full name<input name="name" required></label>
      <div class="row2">
        <label>Phone<input name="phone" type="tel" required></label>
        <label>Email<input name="email" type="email" value="${esc(user?.email || '')}"></label>
      </div>
      <label>What would you like?<textarea name="description" required placeholder="Subject, mood, colours, who it is for…"></textarea></label>
      <div class="row2">
        <label>Preferred size<input name="size" placeholder="e.g. 50×70 cm"></label>
        <label>Preferred medium<input name="medium" placeholder="e.g. oil, digital print"></label>
      </div>
      <label>Budget (optional)<input name="budget" placeholder="${CONFIG.currency}"></label>
      <label>Reference image (optional)<input name="image" type="file" accept="image/*"></label>
      <p class="err" id="err"></p>
      <button class="btn">Send request</button>
    </form>`;
  $('#cu').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = $('button', e.target); btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const file = fd.get('image');
      const image = file && file.size ? await fileToDataUrl(file, 1000) : '';
      const order = {
        id: orderId(), type: 'custom', status: 'new', createdAt: Date.now(),
        customer: { name: fd.get('name').trim(), phone: fd.get('phone').trim(), email: fd.get('email').trim(), address: '', city: '', notes: '' },
        items: [], subtotal: 0, shipping: 0, total: 0,
        custom: { description: fd.get('description').trim(), size: fd.get('size').trim(), medium: fd.get('medium').trim(), budget: fd.get('budget').trim(), image }
      };
      await B.createOrder(order);
      notify(order);
      sessionStorage.setItem('artshop_last', JSON.stringify(order));
      location.hash = '#/done/' + order.id;
    } catch (err) {
      $('#err').textContent = niceErr(err);
      btn.disabled = false; btn.textContent = 'Send request';
    }
  };
}

function login() {
  if (user) { location.hash = user.admin ? '#/admin' : '#/'; return; }
  const reg = authMode === 'register';
  app.innerHTML = head('ACCOUNT / ACCESS', reg ? 'Create account.' : 'Log in.',
    reg ? 'Team members: sign up with the email the owner added to the team, then verify it from your inbox.' : 'Welcome back.') + `
    <form id="auth" class="form narrow">
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      <p class="err" id="err"></p>
      <button class="btn">${reg ? 'Create account' : 'Log in'}</button>
    </form>
    <p class="meta" style="margin-top:20px"><a href="#" id="swap" style="text-decoration:underline">${reg ? 'Have an account? Log in' : 'No account? Create one'}</a>${!reg && !B.demo ? ' · <a href="#" id="forgot" style="text-decoration:underline">Forgot password?</a>' : ''}</p>
    ${B.demo ? '<div class="note">DEMO MODE — Firebase is not configured yet, so everything is saved only in this browser. See README.md to go live.</div>' : ''}`;
  $('#swap').onclick = e => { e.preventDefault(); authMode = reg ? 'login' : 'register'; login(); };
  const fg = $('#forgot');
  if (fg) fg.onclick = async e => {
    e.preventDefault();
    const em = $('#auth input[name=email]').value.trim();
    if (!em) { $('#err').textContent = 'Type your email above first.'; return; }
    try { await B.reset(em); toast('Password reset email sent.'); } catch (err) { $('#err').textContent = niceErr(err); }
  };
  $('#auth').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = $('button', e.target); btn.disabled = true;
    try {
      await (reg ? B.register : B.login).call(B, f.email.trim(), f.password);
      if (reg && !B.demo) toast('Verification email sent — check your inbox.');
    } catch (err) {
      $('#err').textContent = niceErr(err);
      btn.disabled = false;
    }
  };
}

/* ============================== admin ============================== */
function admin() {
  if (!user) { location.hash = '#/login'; return; }
  if (!user.admin) {
    app.innerHTML = head('RESTRICTED', 'No access.',
      user.verified === false
        ? 'Your email is not verified yet. Open the verification email we sent, then log out and log in again.'
        : 'This account is not part of the team.') +
      (user.verified === false ? '<button class="btn ghost" id="resend">Resend verification email</button>' : '');
    const r = $('#resend'); if (r) r.onclick = async () => { try { await B.resend(); toast('Sent.'); } catch (e) { toast(niceErr(e)); } };
    return;
  }
  const tabs = [['orders', 'Orders'], ['works', 'Artworks'], ['team', 'Team'], ['settings', 'Settings']];
  app.innerHTML = head('CONTROL / PANEL', 'Dashboard.') + `
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${adminTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="pane"></div>
    ${B.demo ? '<div class="note">DEMO MODE — data is stored only in this browser. Add your Firebase config (README.md) so orders from customers reach you.</div>' : ''}`;
  renderPane();
}

function renderPane() {
  const el = $('#pane'); if (!el) return;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === adminTab));
  ({ orders: paneOrders, works: paneWorks, team: paneTeam, settings: paneSettings }[adminTab])(el);
}

/* ---- orders ---- */
async function paneOrders(el) {
  el.innerHTML = '<p class="meta">Loading…</p>';
  try { ordersCache = await B.orders(); } catch (e) { el.innerHTML = `<div class="box" style="font-size:16px">Could not load orders: ${esc(niceErr(e))}</div>`; return; }
  if (!ordersCache.length) { el.innerHTML = '<div class="box">No orders yet.</div>'; return; }
  el.innerHTML = ordersCache.map(orderRow).join('');
}

function orderRow(o) {
  const c = o.customer || {};
  const date = new Date(o.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const isC = o.type === 'custom';
  const items = (o.items || []).map(i => `<tr><td style="width:40px">${i.qty}×</td><td>${esc(i.title)}<br><span class="dim">${i.kind === 'original' ? 'Original' : 'Print'} · ${esc(i.size)}</span></td><td class="r">${money(i.price * i.qty)}</td></tr>`).join('');
  const cu = o.custom || {};
  return `<details class="order">
    <summary><b>${esc(o.id)}</b><span class="meta">${isC ? 'CUSTOM' : 'ORDER'}</span><span class="st st-${esc(o.status)}">${esc(o.status)}</span><span class="r">${isC ? '—' : money(o.total)}</span></summary>
    <div class="obody">
      <p class="meta" style="margin-bottom:18px">${date}</p>
      <div class="cols">
        <div><h4>Customer</h4>
          <p><b>${esc(c.name)}</b><br><a href="tel:${esc(c.phone)}" style="text-decoration:underline">${esc(c.phone)}</a>${c.email ? `<br>${esc(c.email)}` : ''}${c.address ? `<br>${esc(c.address)}` : ''}${c.city ? `<br>${esc(c.city)}` : ''}</p>
          ${c.notes ? `<h4 style="margin-top:14px">Notes</h4><p>${esc(c.notes)}</p>` : ''}</div>
        <div>${isC
      ? `<h4>Request</h4><p>${esc(cu.description).replace(/\n/g, '<br>')}</p><p class="meta" style="margin-top:10px">Size: ${esc(cu.size || '-')}<br>Medium: ${esc(cu.medium || '-')}<br>Budget: ${esc(cu.budget || '-')}</p>${cu.image ? `<img class="preview" style="margin-top:12px" src="${esc(cu.image)}" alt="">` : ''}`
      : `<h4>Items</h4><table>${items}
          <tr><td></td><td class="dim">Subtotal</td><td class="r">${money(o.subtotal)}</td></tr>
          <tr><td></td><td class="dim">Shipping</td><td class="r">${money(o.shipping)}</td></tr>
          <tr><td></td><td><b>Total</b></td><td class="r"><b>${money(o.total)}</b></td></tr></table>
          <p class="meta" style="margin-top:8px">${esc(o.payment || '')}</p>`}</div>
      </div>
      <div class="actions" style="margin-top:22px">
        <select data-status="${esc(o.id)}" style="width:auto">${['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <button class="btn sm" data-act="print" data-id="${esc(o.id)}">Print slip</button>
      </div>
    </div></details>`;
}

function printOrder(o) {
  const c = o.customer || {};
  const isC = o.type === 'custom';
  const date = new Date(o.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  $('#print').innerHTML = `
    <h2>artshop/</h2>
    <div>${isC ? 'CUSTOM REQUEST' : 'ORDER'} № <b>${esc(o.id)}</b> · ${date}</div>
    <h3>Ship to</h3>
    <div><b>${esc(c.name)}</b><br>Tel: ${esc(c.phone)}${c.email ? `<br>${esc(c.email)}` : ''}${c.address ? `<br>${esc(c.address)}` : ''}${c.city ? `<br>${esc(c.city)}` : ''}</div>
    ${isC
      ? `<h3>Request</h3><div>${esc(o.custom?.description).replace(/\n/g, '<br>')}<br><br>Size: ${esc(o.custom?.size || '-')} · Medium: ${esc(o.custom?.medium || '-')} · Budget: ${esc(o.custom?.budget || '-')}</div>`
      : `<h3>Items</h3><table>${(o.items || []).map(i => `<tr><td style="width:36px">${i.qty}×</td><td>${esc(i.title)} — ${i.kind === 'original' ? 'ORIGINAL' : 'PRINT'} ${esc(i.size)}</td><td class="r">${money(i.price * i.qty)}</td></tr>`).join('')}
        <tr><td></td><td>Subtotal</td><td class="r">${money(o.subtotal)}</td></tr>
        <tr><td></td><td>Shipping</td><td class="r">${money(o.shipping)}</td></tr>
        <tr class="tot"><td></td><td>TOTAL TO COLLECT</td><td class="r">${money(o.total)}</td></tr></table>
        <div style="margin-top:8px">Payment: ${esc(o.payment || 'Cash on delivery')}</div>`}
    ${c.notes ? `<h3>Notes</h3><div>${esc(c.notes)}</div>` : ''}
    <div style="margin-top:28px;text-align:center">Thank you for supporting independent art ♥</div>`;
  document.body.classList.add('printing');
  window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

/* ---- artworks ---- */
async function paneWorks(el) {
  if (editing) { workForm(el); return; }
  el.innerHTML = '<div class="actions" style="margin-bottom:12px"><button class="btn" data-act="newwork">+ New artwork</button></div>' +
    (artworks.length
      ? [...artworks].sort((a, b) => b.year - a.year).map(a => `
        <div class="work">
          <img src="${esc(th(a))}" alt="">
          <div><h3>${esc(a.title)}</h3><p class="meta">${esc(a.year)} · ${esc(a.medium)} · ${esc(a.dimensions)}${a.published === false ? ' · <b>HIDDEN</b>' : ''}${a.originalPrice > 0 && a.originalAvailable === false ? ' · ORIGINAL SOLD' : ''}</p></div>
          <div class="actions"><button class="btn sm ghost" data-act="editwork" data-id="${esc(a.id)}">Edit</button><button class="btn sm ghost danger" data-act="delwork" data-id="${esc(a.id)}">Delete</button></div>
        </div>`).join('')
      : '<div class="box">No artworks yet. Add your first one.</div>');
}

function workForm(el) {
  const a = editing;
  const pr = [0, 1, 2].map(i => a.prints?.[i] || { size: ['A4 (21×30 cm)', 'A3 (30×42 cm)', 'A2 (42×59 cm)'][i], price: '' });
  formImage = null; formThumb = null;
  const cur = th(a);
  el.innerHTML = `<form id="wf" class="form">
    <h4>${a.id ? 'Edit artwork' : 'New artwork'}</h4>
    <label>Title<input name="title" required value="${esc(a.title || '')}"></label>
    <div class="row2">
      <label>Year<input name="year" type="number" required min="1900" max="2100" value="${esc(a.year || new Date().getFullYear())}"></label>
      <label>Medium / material<input name="medium" required placeholder="Oil on canvas" value="${esc(a.medium || '')}"></label>
    </div>
    <label>Original size<input name="dimensions" required placeholder="50 × 70 cm" value="${esc(a.dimensions || '')}"></label>
    <label>Description (optional)<textarea name="description">${esc(a.description || '')}</textarea></label>
    <label>Image<input name="image" id="img" type="file" accept="image/*"></label>
    <img id="prev" class="preview" ${cur ? `src="${esc(cur)}"` : 'style="display:none"'} alt="">
    <h4 style="margin-top:8px">Original</h4>
    <div class="row2">
      <label>Original price (${CONFIG.currency}) — 0 = not for sale<input name="originalPrice" type="number" min="0" value="${esc(a.originalPrice ?? '')}"></label>
      <label class="chk" style="align-self:end;padding-bottom:12px"><input type="checkbox" name="originalAvailable" ${a.originalAvailable === false ? '' : 'checked'}> Original still available</label>
    </div>
    <h4 style="margin-top:8px">Prints (leave price empty to hide a size)</h4>
    ${pr.map((p, i) => `<div class="printrow"><label>Size ${i + 1}<input name="psize${i}" value="${esc(p.size)}"></label><label>Price (${CONFIG.currency})<input name="pprice${i}" type="number" min="0" value="${esc(p.price)}"></label></div>`).join('')}
    <label class="chk"><input type="checkbox" name="published" ${a.published === false ? '' : 'checked'}> Visible in gallery</label>
    <p class="err" id="err"></p>
    <div class="actions"><button class="btn">Save</button><button type="button" class="btn ghost" data-act="cancelwork">Cancel</button></div>
  </form>`;
  $('#img').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      formImage = await fileToDataUrl(f, 1600, 760000);
      formThumb = await fileToDataUrl(f, 640, 90000);
      const p = $('#prev'); p.src = formThumb; p.style.display = '';
    } catch (err) { $('#err').textContent = err.message; }
  };
  $('#wf').onsubmit = async e => {
    e.preventDefault();
    if (!formThumb && !cur) { $('#err').textContent = 'Please choose an image.'; return; }
    const f = new FormData(e.target);
    const btn = $('button', e.target); btn.disabled = true;
    const art = {
      ...(a.id ? { id: a.id } : {}),
      title: f.get('title').trim(), year: Number(f.get('year')), medium: f.get('medium').trim(),
      dimensions: f.get('dimensions').trim(), description: f.get('description').trim(), thumb: formThumb || cur,
      originalPrice: Number(f.get('originalPrice')) || 0, originalAvailable: f.get('originalAvailable') === 'on',
      prints: [0, 1, 2].map(i => ({ size: f.get('psize' + i).trim(), price: Number(f.get('pprice' + i)) || 0 })),
      published: f.get('published') === 'on', createdAt: a.createdAt || Date.now()
    };
    try {
      await B.saveArtwork(art, formImage || a.image || null);   // a.image = legacy full image kept as-is
      artworks = await B.artworks();
      editing = null; toast('Saved'); renderPane();
    } catch (err) { $('#err').textContent = niceErr(err); btn.disabled = false; }
  };
}

/* ---- team ---- */
async function paneTeam(el) {
  el.innerHTML = '<p class="meta">Loading…</p>';
  let team = [];
  try { team = await B.team(); } catch (e) { el.innerHTML = `<div class="box" style="font-size:16px">${esc(niceErr(e))}</div>`; return; }
  el.innerHTML = `<p class="meta" style="margin-bottom:18px;max-width:560px">Team members see the same dashboard (orders, artworks). They must sign up on the Login page with the exact email you add here and verify it.</p>
    <div class="person"><span>${esc(CONFIG.ownerEmail)}</span><span class="meta">OWNER</span></div>
    ${team.map(t => `<div class="person"><span>${esc(t)}</span>${user.owner ? `<button class="btn sm ghost danger" data-act="rmteam" data-id="${esc(t)}">Remove</button>` : ''}</div>`).join('')}
    ${user.owner
      ? `<form id="tf" class="form" style="margin-top:22px"><label>Add team member email<input name="email" type="email" required></label><button class="btn" style="justify-self:start">Add</button></form>`
      : '<p class="meta" style="margin-top:18px">Only the owner can add or remove members.</p>'}`;
  const tf = $('#tf');
  if (tf) tf.onsubmit = async e => {
    e.preventDefault();
    const em = new FormData(tf).get('email').trim().toLowerCase();
    try { await B.addTeam(em); toast('Added'); paneTeam(el); } catch (err) { toast(niceErr(err)); }
  };
}

/* ---- settings ---- */
function paneSettings(el) {
  el.innerHTML = `<form id="sf" class="form narrow">
    <label>Shipping fee (${CONFIG.currency})<input name="fee" type="number" min="0" value="${esc(settings.shippingFee)}"></label>
    <label>Free shipping over (${CONFIG.currency}) — 0 = off<input name="free" type="number" min="0" value="${esc(settings.freeShippingOver)}"></label>
    <button class="btn" style="justify-self:start">Save</button></form>`;
  $('#sf').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const s = { shippingFee: Number(f.get('fee')) || 0, freeShippingOver: Number(f.get('free')) || 0 };
    try { await B.saveSettings(s); settings = { ...settings, ...s }; toast('Saved'); } catch (err) { toast(niceErr(err)); }
  };
}

/* ============================== global events ============================== */
document.addEventListener('click', async e => {
  if (e.target.closest('#logout')) { e.preventDefault(); await B.logout(); location.hash = '#/'; return; }
  const tab = e.target.closest('[data-tab]');
  if (tab) { adminTab = tab.dataset.tab; editing = null; renderPane(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.dataset.id, k = b.dataset.k;
  if (['inc', 'dec', 'rm'].includes(act)) {
    e.preventDefault();
    let c = cart.get();
    const l = c.find(x => key(x) === k);
    if (l) {
      if (act === 'inc') l.qty++;
      if (act === 'dec') l.qty = Math.max(1, l.qty - 1);
      if (act === 'rm') c = c.filter(x => x !== l);
    }
    cart.set(c); cartView(); return;
  }
  if (act === 'print') { const o = ordersCache.find(x => x.id === id); if (o) printOrder(o); return; }
  if (act === 'newwork') { editing = {}; renderPane(); return; }
  if (act === 'cancelwork') { editing = null; renderPane(); return; }
  if (act === 'editwork') { editing = artworks.find(a => a.id === id); renderPane(); return; }
  if (act === 'delwork') {
    if (!confirm('Delete this artwork permanently?')) return;
    try { await B.deleteArtwork(id); artworks = await B.artworks(); toast('Deleted'); renderPane(); } catch (err) { toast(niceErr(err)); }
    return;
  }
  if (act === 'rmteam') {
    if (!confirm(`Remove ${id} from the team?`)) return;
    try { await B.removeTeam(id); toast('Removed'); renderPane(); } catch (err) { toast(niceErr(err)); }
  }
});

document.addEventListener('change', async e => {
  const s = e.target.closest('[data-status]');
  if (!s) return;
  try {
    await B.updateOrder(s.dataset.status, { status: s.value });
    const o = ordersCache.find(x => x.id === s.dataset.status); if (o) o.status = s.value;
    const badge = s.closest('details').querySelector('.st'); badge.textContent = s.value; badge.className = `st st-${s.value}`;
    toast('Status updated');
  } catch (err) { toast(niceErr(err)); }
});

window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

/* ============================== init ============================== */
(async function init() {
  $('#yr').textContent = new Date().getFullYear();
  app.innerHTML = '<p class="meta">Loading…</p>';
  if (CONFIG.firebase && CONFIG.firebase.apiKey) {
    try { B = await firebaseBackend(CONFIG.firebase); } catch (e) { console.error(e); B = demoBackend(); }
  } else B = demoBackend();
  $('#mode').textContent = B.demo ? 'demo mode' : '';
  try { const s = await B.settings(); if (s) settings = { ...settings, ...s }; } catch { }
  try { artworks = await B.artworks(); } catch (e) { console.error(e); artworks = []; }
  B.onAuth(u => { user = u; route(); });
  route();
})();
