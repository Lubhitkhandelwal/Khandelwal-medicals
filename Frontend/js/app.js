/* ════════════════════════════════════════════════════════════════
   DATA
   ════════════════════════════════════════════════════════════════ */

const STORE = {
  name: 'Khandelwal Medicals',
  address: 'Khandelwal Medicals, Sonkh Road, Kumher — 321201',
  phone: '+91 63789 66072',
  deliveryCharge: 20,
  freeDeliveryAbove: 250,
};

// ── Products ──────────────────────────────────────────────────
// Loaded from backend API on page init
let PRODUCTS = [];
let CATEGORIES = ['All'];

async function loadProducts() {
  try {
    // const res = await fetch('http://localhost:4000/api/products');
    const res = await fetch('https://khandelwal-medicals-production.up.railway.app/api/products');
    const data = await res.json();
    // Map backend fields to frontend shape
    PRODUCTS = data.products.map(p => ({
      id:          p.id,
      name:        p.name,
      brand:       p.brand,
      composition: p.description || '',
      pack:        p.unit || '',
      category:    p.category,
      mrp:         p.mrp,
      price:       p.price,
      inStock:     p.stock > 0,
      tags:        [],
    }));
    CATEGORIES = ['All', ...new Set(PRODUCTS.map(p => p.category))];
  } catch (err) {
    console.error('Failed to load products:', err);
    document.getElementById('productGrid').innerHTML =
      `<div class="no-results"><div class="no-results-icon">⚠️</div><p style="font-size:16px;font-weight:500;color:var(--gray-600)">Could not load products</p><p style="font-size:14px;margin-top:4px">Make sure the backend is running on port 4000</p></div>`;
  }
}

// async function loadProducts() {
//   try {
//     const [productsRes, catsRes] = await Promise.all([
//       fetch('http://localhost:4000/api/products'),
//       fetch('http://localhost:4000/api/products/categories'),
//     ]);
//     const data = await productsRes.json();
//     PRODUCTS = data.products.map(p => ({
//       id:          p.id,
//       name:        p.name,
//       brand:       p.brand,
//       composition: p.description || '',
//       pack:        p.unit || '',
//       category:    p.category,
//       mrp:         p.mrp,
//       price:       p.price,
//       inStock:     p.stock > 0,
//       imageUrl:    p.imageUrl || null,
//       tags:        [],
//     }));
//     const cats = await catsRes.json();
//     CATEGORIES = ['All', ...cats.map(c => ({ name: c.name, icon: c.icon }))];
//   } catch (err) {
//     console.error('Failed to load products:', err);
//     document.getElementById('productGrid').innerHTML =
//       `<div class="no-results"><div class="no-results-icon">⚠️</div><p style="font-size:16px;font-weight:500;color:var(--gray-600)">Could not load products</p><p style="font-size:14px;margin-top:4px">Make sure the backend is running on port 4000</p></div>`;
//   }
// }  

const CAT_ICONS = {
  'All':'🏪','Pain Relief':'💊','Vitamins':'🌿','Cold & Cough':'🌬️',
  'Digestion':'⚡','Skin Care':'✨','First Aid':'🩹','Devices':'🩺',
  'Eye Care':'👁️','Hygiene':'🧴','Cosmetics':'💄',
'Facewash':'🧼',
'Moisturizer':'🧴',
'Serum':'💧',
};

/* ════════════════════════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════════════════════════ */

let cart         = {};          // { productId: qty }
let fulfillment  = 'delivery';  // 'delivery' | 'pickup'
let locationLat = null;
let locationLng = null;
let activeCategory = 'All';

/* ════════════════════════════════════════════════════════════════
   CART HELPERS
   ════════════════════════════════════════════════════════════════ */

// function itemCount()    { return Object.values(cart).reduce((s,q) => s+q, 0); }
function itemCount()    { return Object.values(cart).reduce((s,q) => s + (q?.isRx ? 1 : q), 0); }
function getRxItems()   { return Object.entries(cart).filter(([,v]) => v?.isRx); }
function hasRxItem()    { return getRxItems().length > 0; }
function subtotal()     { return PRODUCTS.reduce((s,p) => s + (cart[p.id]||0)*p.price, 0); }
function mrpTotal()     { return PRODUCTS.reduce((s,p) => s + (cart[p.id]||0)*p.mrp, 0); }
function savings()      { return mrpTotal() - subtotal(); }
function deliveryCharge(){
  if (fulfillment === 'pickup') return 0;
  return subtotal() >= STORE.freeDeliveryAbove ? 0 : STORE.deliveryCharge;
}
function grandTotal()   { return subtotal() + deliveryCharge(); }

function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  refresh();
}
function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  refresh();
}
function clearCart() {
  cart = {};
  refresh();
}

// Central refresh — keeps everything in sync
function refresh() {
  updateBadge();
  renderProducts();
  renderCartItems();
}

function updateBadge() {
  const n = itemCount();
  const badge = document.getElementById('cartBadge');
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

/* ════════════════════════════════════════════════════════════════
   FULFILLMENT
   ════════════════════════════════════════════════════════════════ */

function setFulfillment(mode) {
  fulfillment = mode;

  // Main toggle
  document.getElementById('btnDelivery').classList.toggle('active', mode==='delivery');
  document.getElementById('btnPickup').classList.toggle('active', mode==='pickup');

  // Cart toggle
  document.getElementById('cartBtnDelivery').classList.toggle('active', mode==='delivery');
  document.getElementById('cartBtnPickup').classList.toggle('active', mode==='pickup');

  // Note
  document.getElementById('fulfillmentNote').textContent =
    mode === 'delivery'
      ? `₹${STORE.deliveryCharge} charge · Free above ₹${STORE.freeDeliveryAbove}`
      : `📍 ${STORE.address}`;

  // COD label
  document.getElementById('codLabel').textContent =
    mode === 'pickup' ? '💵 Cash at store' : '💵 Cash on delivery';

  // Show/hide address fields in checkout
  updateCheckoutMode();
  renderCartItems(); // recalculate totals
}

function updateCheckoutMode() {
  const isDelivery = fulfillment === 'delivery';
  document.getElementById('addressSection').style.display = isDelivery ? '' : 'none';
  document.getElementById('pickupNote').classList.toggle('hidden', isDelivery);

  const badge = document.getElementById('modalFulfillmentBadge');
  if (isDelivery) {
    badge.style.background = '#eff6ff'; badge.style.color = '#1d4ed8';
    badge.textContent = '🚚 Home Delivery';
  } else {
    badge.style.background = '#fffbeb'; badge.style.color = '#92400e';
    badge.textContent = '🏪 Store Pickup — ' + STORE.address;
  }
}

/* ════════════════════════════════════════════════════════════════
   CATEGORY FILTER
   ════════════════════════════════════════════════════════════════ */

function buildCategories() {
  const row = document.getElementById('categories');
  row.innerHTML = CATEGORIES.map(cat => `
    <button
      class="cat-chip ${cat === activeCategory ? 'active' : ''}"
      onclick="setCategory('${cat}')"
    >
      ${CAT_ICONS[cat] || '🔹'} ${cat}
    </button>
  `).join('');
}

// function buildCategories() {
//   const row = document.getElementById('categories');
//   row.innerHTML = CATEGORIES.map(cat => {
//     const name = cat === 'All' ? 'All' : cat.name;
//     const icon = cat === 'All' ? '🏪' : cat.icon || '🔹';
//     return `<button
//       class="cat-chip ${name === activeCategory ? 'active' : ''}"
//       onclick="setCategory('${name}')"
//     >${icon} ${name}</button>`;
//   }).join('');
// }

function setCategory(cat) {
  activeCategory = cat;
  buildCategories();
  renderProducts();
}

/* ════════════════════════════════════════════════════════════════
   SEARCH
   ════════════════════════════════════════════════════════════════ */

function getSearch() { return document.getElementById('searchInput').value.toLowerCase().trim(); }

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearch').classList.add('hidden');
  renderProducts();
}

document.getElementById('searchInput').addEventListener('input', function() {
  document.getElementById('clearSearch').classList.toggle('hidden', !this.value);
  renderProducts();
});

/* ════════════════════════════════════════════════════════════════
   PRODUCT GRID
   ════════════════════════════════════════════════════════════════ */

function renderProducts() {
  const q = getSearch();
  const filtered = PRODUCTS.filter(p => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchQ = !q
      || p.name.toLowerCase().includes(q)
      || p.brand.toLowerCase().includes(q)
      || p.composition.toLowerCase().includes(q)
      || (p.tags || []).some(t => t.includes(q));
    return matchCat && matchQ;
  });

  const label = activeCategory === 'All' ? '' : ` in ${activeCategory}`;
  document.getElementById('resultsCount').textContent =
    `${filtered.length} product${filtered.length !== 1 ? 's' : ''}${label}`;

  const grid = document.getElementById('productGrid');

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <p style="font-size:16px;font-weight:500;color:var(--gray-600)">No products found</p>
        <p style="font-size:14px;margin-top:4px">Try a different search or category</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const disc = Math.round((p.mrp - p.price) / p.mrp * 100);
    const qty  = cart[p.id] || 0;

    const cta = !p.inStock
      ? `<span class="oos-badge">Out of stock</span>`
      : qty === 0
        ? `<button class="btn-outline" onclick="addToCart('${p.id}')">🛒 Add to cart</button>`
        : `<div class="qty-control">
             <button class="qty-btn" onclick="changeQty('${p.id}',-1)">−</button>
             <span class="qty-num">${qty}</span>
             <button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button>
           </div>`;

    return `
      <div class="product-card">
        ${p.imageUrl
          ? `<img src="${p.imageUrl}" class="prod-img" onerror="this.style.display='none'" />`
          : `<div class="prod-icon">💊</div>`}
        <p class="prod-name">${p.name}</p>
        <p class="prod-brand">${p.brand}</p>
        <p class="prod-comp">${p.composition}</p>
        <p class="prod-pack">${p.pack}</p>
        <div class="prod-pricing">
          <span class="prod-price">₹${p.price}</span>
          <span class="prod-mrp">₹${p.mrp}</span>
          <span class="prod-disc">${disc}% off</span>
        </div>
        ${cta}
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════════
   CART PANEL
   ════════════════════════════════════════════════════════════════ */

function openCart() {
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartPanel').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  const footer    = document.getElementById('cartFooter');
  const clearBtn  = document.getElementById('clearCartBtn');
  const countEl   = document.getElementById('cartItemCount');

  const keys = Object.keys(cart);
  const n    = itemCount();

  countEl.textContent = n ? `(${n} item${n>1?'s':''})` : '';
  clearBtn.classList.toggle('hidden', keys.length === 0);

  if (keys.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Your cart is empty</p>
        <span>Browse our medicines and add what you need</span>
        <button class="btn-primary" style="margin-top:1.25rem;padding:9px 22px" onclick="closeCart()">Browse medicines</button>
      </div>`;
    footer.classList.add('hidden');
    return;
  }

  footer.classList.remove('hidden');

  container.innerHTML = keys.map(id => {
    // Prescription item
    if (cart[id]?.isRx) {
      const rx = cart[id];
      return `
        <div class="cart-item">
          <div class="ci-icon" style="background:#f3e8ff">📋</div>
          <div class="ci-info">
            <p class="ci-name">Prescription Medicines</p>
            <p class="ci-sub">${rx.daysRequired} days supply${rx.notes ? ' · ' + rx.notes : ''}</p>
            <div style="margin-top:4px">
              <a href="${rx.prescriptionUrl}" target="_blank" style="font-size:11px;color:var(--brand-600);text-decoration:underline">View prescription →</a>
            </div>
            <div class="ci-bottom" style="margin-top:6px">
              <span class="ci-rx-price">Price TBD after packing</span>
              <button class="ci-qty-btn" onclick="changeQty('${id}',-1)" style="background:#fef2f2;color:var(--red)">🗑</button>
            </div>
          </div>
        </div>`;
    }
    const p   = PRODUCTS.find(x => x.id === id);
    const qty = cart[id];
    if (!p) return '';
    return `
      <div class="cart-item">
        <div class="ci-icon">💊</div>
        <div class="ci-info">
          <p class="ci-name">${p.name}</p>
          <p class="ci-sub">${p.brand} · ${p.pack}</p>
          <div class="ci-bottom">
            <span class="ci-price">₹${p.price * qty}</span>
            <div class="ci-qty">
              <button class="ci-qty-btn" onclick="changeQty('${id}',-1)">−</button>
              <span>${qty}</span>
              <button class="ci-qty-btn" onclick="changeQty('${id}',1)">+</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  // Totals
  document.getElementById('totalMrp').textContent     = `₹${mrpTotal()}`;
  document.getElementById('totalSavings').textContent  = `−₹${savings()}`;
  const dc = deliveryCharge();
  document.getElementById('deliveryAmt').textContent   =
    dc === 0 ? (fulfillment==='pickup' ? 'FREE (pickup)' : 'FREE') : `₹${dc}`;
  document.getElementById('grandTotal').textContent = hasRxItem() ? `₹${grandTotal()} + Rx` : `₹${grandTotal()}`;
  document.getElementById('rxCartNote').classList.toggle('hidden', !hasRxItem());
}

/* ════════════════════════════════════════════════════════════════
   CHECKOUT MODAL
   ════════════════════════════════════════════════════════════════ */

function openCheckout() {
  closeCart();
  updateCheckoutMode();

  // Populate summary
  const items = Object.keys(cart).map(id => {

  // Prescription item
  if (cart[id]?.isRx) {
    return `
      <div class="summary-item">
        <span>📋 Prescription Medicines</span>
        <span>Price TBD</span>
      </div>
    `;
  }

  const p = PRODUCTS.find(x => String(x.id) === String(id));

  if (!p) {
    console.error("Missing product:", id);
    return '';
  }

  return `
    <div class="summary-item">
      <span>${p.name} × ${cart[id]}</span>
      <span>₹${p.price * cart[id]}</span>
    </div>
  `;
}).join('');
  document.getElementById('modalSummaryItems').innerHTML = items;
  document.getElementById('modalTotal').textContent = `₹${grandTotal()}`;

  document.getElementById('checkoutOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset to form view
  document.getElementById('checkoutForm').classList.remove('hidden');
  document.getElementById('successScreen').classList.add('hidden');
  document.getElementById('modalTitle').textContent = 'Complete your order';
}

function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function selectPayment(val, el) {
  document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
}

async function placeOrder() {
  // Validate
  let ok = true;
  const name  = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();

  const setErr = (id, errId, show) => {
    document.getElementById(id).classList.toggle('input-error', show);
    document.getElementById(errId).classList.toggle('hidden', !show);
    if (show) ok = false;
  };

  setErr('custName',  'errName',  !name);
  setErr('custPhone', 'errPhone', !/^[6-9]\d{9}$/.test(phone));

  if (fulfillment === 'delivery') {
    const addr = document.getElementById('custAddress').value.trim();
    const pin  = document.getElementById('custPin').value.trim();
    setErr('custAddress', 'errAddress', !addr);
    // setErr('custPin', 'errPin', !/^\d{6}$/.test(pin));
    const validPin = pin === '321201';
    document.getElementById('errPin').textContent = 
      !/^\d{6}$/.test(pin) ? 'Enter valid 6-digit pincode' : 'Sorry, we only deliver within Kumher (321201) currently';
    setErr('custPin', 'errPin', !validPin);
  }

  if (!ok) return;

  // Show loading
  const btn = document.getElementById('placeBtn');
  btn.disabled = true;
  btn.textContent = 'Placing order…';

  const address  = fulfillment === 'delivery' ? document.getElementById('custAddress').value.trim() : '';
  const pincode  = fulfillment === 'delivery' ? document.getElementById('custPin').value.trim() : '';
  const payment  = document.querySelector('input[name="payment"]:checked')?.value || 'upi';

  // Build items array from cart
  const items = Object.keys(cart).map(id => ({ productId: id, quantity: cart[id] }));

  try {
    const res = await fetch('https://khandelwal-medicals-production.up.railway.app/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer:        { name, phone },
        items,
        fulfillment,
        deliveryAddress: fulfillment === 'delivery' ? `${address}, ${pincode}` : null,
        paymentMethod:   payment,
        latitude:        locationLat,
        longitude:       locationLng,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Order failed');
    showSuccess(data.order.orderNumber, name);
  } catch (err) {
    alert('Could not place order: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place order →';
  }
}

function showSuccess(orderId, name) {
  // Build items list
  const itemsHtml = Object.keys(cart).map(id => {
    const p = PRODUCTS.find(x => x.id === id);
    return `<div class="success-item"><span>${p.name} × ${cart[id]}</span><span>₹${p.price * cart[id]}</span></div>`;
  }).join('');

  document.getElementById('successItemsList').innerHTML = itemsHtml;
  document.getElementById('successTotal').textContent = `₹${grandTotal()}`;
  document.getElementById('successOrderId').textContent = '#' + orderId;
  document.getElementById('successHeading').textContent = `Thank you, ${name.split(' ')[0]}!`;
  document.getElementById('modalTitle').textContent = 'Order Placed! 🎉';

  const msg = fulfillment === 'pickup'
    ? 'Your order is confirmed. Medicines will be ready for pickup in ~30 minutes. Show your Order ID at the counter.'
    : 'Your order is confirmed. Our delivery partner will contact you shortly.';
  document.getElementById('successMsg').textContent = msg;
  document.getElementById('successPickupNote').textContent = fulfillment === 'pickup'
    ? '📍 ' + STORE.address : '';

  document.getElementById('checkoutForm').classList.add('hidden');
  document.getElementById('successScreen').classList.remove('hidden');

  // Clear cart and close panel
  cart = {};
  refresh();
  closeCart();
}

function finishOrder() {
  closeCheckout();
  // Reset form fields
  ['custName','custPhone','custAddress','custPin'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('input-error');
  });
  ['errName','errPhone','errAddress','errPin'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
}

function syncSearch(val) {
  document.getElementById('searchInput').value = val;
  document.getElementById('clearSearch').classList.toggle('hidden', !val);
  renderProducts();
}

/* ════════════════════════════════════════════════════════════════
   LOCATION
   ════════════════════════════════════════════════════════════════ */
function useMyLocation() {
  const btn    = document.getElementById('locBtn');
  const status = document.getElementById('locStatus');

  if (!navigator.geolocation) {
    status.textContent = '❌ Location not supported on this browser';
    return;
  }

  btn.textContent = '⏳ Getting location…';
  btn.disabled    = true;
  status.textContent = '';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      locationLat = latitude;
      locationLng = longitude;
      status.textContent = '🔄 Converting to address…';

      try {
        // Free reverse geocoding — no API key needed
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();

        // Build a readable address from parts
        const a = data.address;
        const parts = [
          a.house_number,
          a.road || a.pedestrian || a.street,
          a.neighbourhood || a.suburb,
          a.city || a.town || a.village || a.county,
          a.state,
        ].filter(Boolean);

        const fullAddress = parts.join(', ');
        const pin         = a.postcode || '';

        document.getElementById('custAddress').value = fullAddress;
        if (pin) document.getElementById('custPin').value = pin;

        status.style.color   = '#16a34a';
        status.textContent   = '✅ Location filled! Please verify the address.';
      } catch (err) {
        status.style.color  = '#ef4444';
        status.textContent  = '❌ Could not convert location. Please type manually.';
      }

      btn.textContent = '📍 Use my location';
      btn.disabled    = false;
    },
    (err) => {
      const msgs = {
        1: '❌ Location permission denied. Please allow location access.',
        2: '❌ Location unavailable. Please type manually.',
        3: '❌ Location request timed out. Please try again.',
      };
      status.style.color  = '#ef4444';
      status.textContent  = msgs[err.code] || '❌ Could not get location.';
      btn.textContent     = '📍 Use my location';
      btn.disabled        = false;
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

/* ════════════════════════════════════════════════════════════════
   PRESCRIPTION
   ════════════════════════════════════════════════════════════════ */

const CLOUDINARY_CLOUD  = 'dks0tcara';
const CLOUDINARY_PRESET = 'km_prescriptions';
let rxDays = 30;
let rxFile = null;

function openRxModal() {
  document.getElementById('rxOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeRxModal() {
  document.getElementById('rxOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
function handleRxFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5MB.'); return; }
  rxFile = file;
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('rxPreviewImg').src = e.target.result; document.getElementById('rxPreviewImg').classList.remove('hidden'); };
    reader.readAsDataURL(file);
  } else { document.getElementById('rxPreviewImg').classList.add('hidden'); }
  document.getElementById('rxFileName').textContent = file.name;
  document.getElementById('rxUploadPlaceholder').classList.add('hidden');
  document.getElementById('rxUploadPreview').classList.remove('hidden');
  document.getElementById('rxUploadArea').classList.add('has-file');
}
function removeRxFile(e) {
  e.stopPropagation();
  rxFile = null;
  document.getElementById('rxFileInput').value = '';
  document.getElementById('rxUploadPlaceholder').classList.remove('hidden');
  document.getElementById('rxUploadPreview').classList.add('hidden');
  document.getElementById('rxUploadArea').classList.remove('has-file');
  document.getElementById('rxUploadArea').style.borderColor = '';
}
function selectRxDays(days, el) {
  document.querySelectorAll('.rx-day-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  rxDays = days;
  const ci = document.getElementById('rxCustomDays');
  if (days === 'custom') {
    ci.classList.remove('hidden'); ci.focus(); rxDays = null;
    ci.oninput = () => { rxDays = parseInt(ci.value) || null; };
  } else { ci.classList.add('hidden'); }
}
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  fd.append('folder', 'prescriptions');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method:'POST', body:fd });
  if (!res.ok) throw new Error('Image upload failed');
  return (await res.json()).secure_url;
}
async function addRxToCart() {
  if (!rxFile) { document.getElementById('rxUploadArea').style.borderColor = 'var(--red)'; return; }
  if (!rxDays) { alert('Please select number of days'); return; }
  const btn = document.getElementById('rxAddBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';
  try {
    const url   = await uploadToCloudinary(rxFile);
    const notes = document.getElementById('rxNotes').value.trim();
    cart['RX_' + Date.now()] = { isRx:true, prescriptionUrl:url, daysRequired:rxDays, notes };
    closeRxModal(); openCart(); refresh();
    rxFile = null; rxDays = 30;
    document.getElementById('rxFileInput').value = '';
    document.getElementById('rxUploadPlaceholder').classList.remove('hidden');
    document.getElementById('rxUploadPreview').classList.add('hidden');
    document.getElementById('rxUploadArea').classList.remove('has-file');
    document.getElementById('rxUploadArea').style.borderColor = '';
    document.getElementById('rxNotes').value = '';
    document.querySelectorAll('.rx-day-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.rx-day-btn')[2].classList.add('active');
  } catch(err) { alert('Upload failed: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = '📋 Add prescription to cart →'; }
}
document.getElementById('rxOverlay').addEventListener('click', function(e) { if (e.target === this) closeRxModal(); });

/* ════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════ */
// ── INIT ──────────────────────────────────────────────────────
(async () => {
  await loadProducts();
  buildCategories();
  renderProducts();
  setFulfillment('delivery');
})();