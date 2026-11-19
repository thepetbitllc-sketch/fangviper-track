/* Drevaunt order tracking page.
   Real orders: /?t=<secret token> -> GET /api/order/<token> on the Worker (see api-base in index.html).
   An order has up to two parts that ship separately: printed pieces made to order (Printful, "pod")
   and ready-made pieces from the warehouse (Zendrop, "stock"). Each part has its own steps and tracking.
   Sample order (?demo, or locally): stage and product switcher for previewing the look. */
(() => {
  const DAY = 864e5;
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  /* ---------- made to order (Printful) ---------- */

  // What changes per printed product: the noun, step 3 (each product is finished differently) and the press/check/pack lines.
  const KINDS = {
    tee: {
      noun: 'shirt',
      step3: ['Curing', 'Heat curing', 'The heat press locks the ink in, so the print holds up through the washer and every hard session after it.'],
      press: 'Your shirt is on the platen. The print head lays the ink straight into the fabric, pass by pass.',
      check: 'One last look at the print and the seams before your shirt moves on.',
      pack: 'Folded, packed and labeled. Waiting for the courier to pick it up.'
    },
    bag: {
      noun: 'gym bag',
      step3: ['Sewing', 'Cut and sewn', 'The printed panels are cut and stitched together into your bag.'],
      press: 'Your design is being printed onto the fabric panels that will become your gym bag.',
      check: 'One last look at the print, the seams and the zipper before your bag moves on.',
      pack: 'Packed and labeled. Waiting for the courier to pick it up.'
    },
    bottle: {
      noun: 'bottle',
      step3: ['Setting', 'Setting the print', 'The print is left to set, so it holds up to everyday use.'],
      press: 'Your design is being printed onto your bottle.',
      check: 'One last look at the print and the lid before your bottle moves on.',
      pack: 'Wrapped, packed and labeled. Waiting for the courier to pick it up.'
    },
    mug: {
      noun: 'mug',
      step3: ['Heat set', 'Heat set', 'Heat presses the design into the mug, so it stays sharp sip after sip.'],
      press: 'Your design is being printed and lined up to wrap around your mug.',
      check: 'One last look at the print, edge to edge, before your mug moves on.',
      pack: 'Wrapped, packed and labeled. Waiting for the courier to pick it up.'
    },
    journal: {
      noun: 'journal',
      step3: ['Binding', 'Binding', 'The pages are stacked and bound into your printed cover.'],
      press: 'Your cover is being printed, edge to edge.',
      check: 'One last look at the cover and the binding before your journal moves on.',
      pack: 'Packed and labeled. Waiting for the courier to pick it up.'
    },
    item: {
      noun: 'piece',
      step3: ['Finishing', 'Finishing', 'The print is set and the last details are finished.'],
      press: 'Your design is being printed onto your piece.',
      check: 'One last look at the print before your piece moves on.',
      pack: 'Packed and labeled. Waiting for the courier to pick it up.'
    }
  };

  function podStages(kind) {
    const k = KINDS[kind];
    return [
      { label: 'Artwork', title: 'Artwork prepped', copy: `Your order is in. The design file is being lined up for your ${k.noun} before anything gets printed.` },
      { label: 'Printing', title: 'On the press', copy: k.press },
      { label: k.step3[0], title: k.step3[1], copy: k.step3[2] },
      { label: 'Check', title: 'Quality check', copy: k.check },
      { label: 'Packed', title: 'Packed', copy: k.pack },
      { label: 'Shipped', title: 'On its way', copy: 'It is out the door. Follow every step with the tracking link below.' }
    ];
  }

  /* ---------- from the warehouse (Zendrop) ---------- */

  // Warehouse products only change the drawing; the steps are the same for all of them.
  const STOCK_KINDS = ['suit', 'pants', 'shirt', 'tee', 'shoes', 'tie', 'socks', 'gear'];
  const STOCK_STAGES = [
    { label: 'Confirmed', title: 'Order confirmed', copy: 'Your order is in and lined up for our warehouse team.' },
    { label: 'Picked', title: 'Picked from the shelves', copy: 'Your pieces are being pulled from the shelves and matched to your order.' },
    { label: 'Checked', title: 'Quality check', copy: 'Every piece is checked for size, color and finish before it is packed.' },
    { label: 'Ready', title: 'Getting ready to ship', copy: 'Packing and labeling. Your tracking link lands here the moment it leaves the warehouse.' },
    { label: 'Shipped', title: 'On its way', copy: 'It is out the door. Follow every step with the tracking link below.' }
  ];

  // After the last step, a new "almost there" moment each day, so a long wait never shows the same thing twice.
  // They stay about preparing the box and never claim it has shipped; tracking takes over the moment it does.
  const MOMENTS = [
    { title: 'Box sealed', copy: 'Taped shut and ready for its label.' },
    { title: 'Shipping label printed', copy: 'Your label is printed with your address, ready to go on the box.' },
    { title: 'Final address check', copy: 'One last look at the label, so your order goes to the right door.' },
    { title: 'Sorted for pickup', copy: 'Your box is sorted into the outgoing batch for the courier.' },
    { title: 'Waiting for courier pickup', copy: 'Ready at the dock. Your tracking link appears here the moment the courier scans it.' }
  ];

  // A different line under the day counter every day until the order ships.
  const DAILY = [
    'Something new happens here every day. Check back tomorrow.',
    'Moving every day, even when you cannot see it.',
    'Made for you, not pulled from a pile. Worth the wait.',
    'Standards take time. Yours is on its way.',
    'Another step closer than yesterday.',
    'Patience is part of the discipline. Almost there.',
    'Tomorrow brings the next step. Same place.'
  ];

  const PART = {
    pod: { tab: 'Made for you', stages: podStages, status: ['Made to order', 'Every print is made after you order it. You will get an email with tracking the moment it ships.'], together: 'The rest of this part is being made alongside it.' },
    stock: { tab: 'From our warehouse', stages: () => STOCK_STAGES, status: ['Ships from our warehouse', 'Ready-made and checked before it leaves. You will get an email with tracking the moment it ships.'], together: 'The rest of this part is packed alongside it.' }
  };

  const TIPS = [
    'Nobody is coming. Show up anyway.',
    'Motivation is a guest. Discipline lives here.',
    'Small reps every day beat big plans someday.',
    'What you measure, you can move.',
    'Do the boring work. That is where it gets built.',
    'Your future self is watching what you do today.',
    'Comfort is the one rival you invite in.'
  ];

  const $ = (id) => document.getElementById(id);
  const fmt = (d, opts) => new Date(d).toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' });

  // The backend tags each item; older orders fall back to the title.
  function kindOf(it, source) {
    if (source === 'stock') return STOCK_KINDS.includes(it.kind) ? it.kind : 'gear';
    if (KINDS[it.kind]) return it.kind;
    const t = (it.title || '').toLowerCase();
    if (/t-?shirt|\btee\b/.test(t)) return 'tee';
    if (/\bbag\b/.test(t)) return 'bag';
    if (/bottle/.test(t)) return 'bottle';
    if (/\bmug\b/.test(t)) return 'mug';
    if (/journal|notebook/.test(t)) return 'journal';
    return 'item';
  }
  const symbolOf = (kind) => (kind === 'gear' ? 'item' : kind);

  // One step per day since the order, holding on the last step before shipping
  // (Printful takes 2 to 5 days, so Packed from day 5; the warehouse holds on "Getting ready to ship").
  // As soon as a part ships, it jumps straight to "On its way", even on day 2.
  function pickStage(o, part) {
    const last = PART[part.source].stages('item').length - 1;
    if (part.status === 'shipped') return last;
    const days = Math.floor((Date.now() - new Date(o.placed)) / DAY);
    return Math.min(Math.max(days, 0), last - 1);
  }

  // Days past the last step before shipping: 0 = first waiting moment; holds on the last one. -1 = none.
  function pickMoment(o, part) {
    const last = PART[part.source].stages('item').length - 1;
    if (part.status === 'shipped') return -1;
    const days = Math.floor((Date.now() - new Date(o.placed)) / DAY);
    return days > last - 1 ? Math.min(days - last, MOMENTS.length - 1) : -1;
  }

  // Orders stored before the warehouse flow come back as a single printed part.
  const partsOf = (o) => o.groups || [{ source: 'pod', status: o.status, items: o.items, tracking: o.tracking }];

  function render(o, partIndex, forcedStage, forcedMoment) {
    const parts = partsOf(o);
    const part = parts[partIndex];
    const flow = PART[part.source];
    const kinds = part.items.map((it) => kindOf(it, part.source));
    const kind = kinds[0] || (part.source === 'stock' ? 'gear' : 'item');
    const stages = flow.stages(part.source === 'pod' ? kind : null);
    const stage = forcedStage ?? pickStage(o, part);
    const shipped = stage === stages.length - 1;
    const moment = shipped ? -1 : forcedMoment ?? (forcedStage === undefined ? pickMoment(o, part) : -1);
    const s = moment >= 0 ? MOMENTS[moment] : stages[stage];
    const day = Math.floor((Date.now() - new Date(o.placed)) / DAY) + 1;

    $('orderNo').textContent = 'Order ' + o.number;
    $('placed').textContent = 'Placed ' + fmt(o.placed, { month: 'short', day: 'numeric' });
    $('stageTitle').textContent = s.title;
    $('stageDay').textContent = 'Day ' + day + ' of your order';
    $('daily').textContent = shipped ? '' : DAILY[(day - 1) % DAILY.length];
    $('stageCopy').textContent = s.copy + (new Set(kinds).size > 1 && !shipped && moment < 0 ? ' ' + flow.together : '');
    document.title = s.title + ' | Drevaunt';

    // Tabs when the order ships in two parts.
    const tabs = $('parts');
    tabs.hidden = parts.length < 2;
    tabs.replaceChildren(...parts.map((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === partIndex));
      b.textContent = PART[p.source].tab + (p.status === 'shipped' ? ' · shipped' : '');
      b.addEventListener('click', () => render(o, i, forcedStage === undefined ? undefined : Math.min(forcedStage, PART[p.source].stages('item').length - 1), forcedMoment));
      return b;
    }));

    // Scenes: printed parts use data-stage, warehouse parts data-stock; both draw the item's own outline.
    const sym = symbolOf(kind);
    document.querySelectorAll('#scene use[data-obj]').forEach((u) => {
      const id = u.dataset.obj === 'pack' && $(sym + '-pack') ? sym + '-pack' : sym;
      u.setAttribute('href', '#' + id);
    });
    document.querySelectorAll('#scene > svg').forEach((svg) => {
      const only = svg.dataset.kind;
      const show = moment >= 0
        ? svg.dataset.moment !== undefined && +svg.dataset.moment === moment
        : part.source === 'pod'
          ? +svg.dataset.stage === stage && svg.dataset.stage !== undefined && (!only || only.split(',').includes(kind))
          : svg.dataset.stock !== undefined && +svg.dataset.stock === stage;
      svg.toggleAttribute('hidden', !show);
    });
    // Warehouse pieces are not printed, so the scenes leave the Drevaunt print off them.
    document.querySelectorAll('#scene .print').forEach((el) => { el.style.display = part.source === 'stock' ? 'none' : ''; });

    const steps = $('steps');
    steps.style.gridTemplateColumns = `repeat(${stages.length}, 1fr)`;
    steps.replaceChildren(...stages.map((st, i) => {
      const li = document.createElement('li');
      li.textContent = st.label;
      li.className = i < stage ? 'done' : i === stage ? 'now' : '';
      if (i === stage) li.setAttribute('aria-current', 'step');
      return li;
    }));

    const btn = $('trackBtn');
    if (shipped && part.tracking) {
      $('statusBig').textContent = 'Shipped ' + fmt(part.tracking.shippedAt, { month: 'short', day: 'numeric' });
      $('statusSub').textContent = [part.tracking.carrier, part.tracking.number].filter(Boolean).join('  /  ');
      btn.href = part.tracking.url;
      btn.hidden = !part.tracking.url;
    } else {
      $('statusBig').textContent = flow.status[0];
      $('statusSub').textContent = flow.status[1];
      btn.hidden = true;
    }

    $('items').replaceChildren(...part.items.map((it) => {
      const row = document.createElement('div');
      row.className = it.image ? 'row row--img' : 'row';
      if (it.image) {
        const img = document.createElement('img');
        img.src = it.image; img.alt = ''; img.loading = 'lazy';
        row.append(img);
      }
      const name = document.createElement('span');
      name.className = 'row__name';
      name.textContent = it.title;
      const hint = document.createElement('span');
      hint.className = 'row__hint';
      hint.textContent = it.variant;
      name.append(hint);
      const qty = document.createElement('span');
      qty.className = 'row__v';
      qty.textContent = 'x' + it.qty;
      row.append(name, qty);
      return row;
    }));

    $('otherNote').hidden = parts.length < 2;
    $('otherNote').textContent = 'This order ships in two parts. Switch between them at the top of the page.';

    $('changeNote').textContent = shipped
      ? 'Questions about the delivery? Message us and we will help you out.'
      : 'Something wrong with your order? Message us and we will sort it out.';

    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY);
    $('tip').textContent = TIPS[doy % TIPS.length];

    $('app').hidden = false;
  }

  /* ---------- sample order ---------- */

  const SAMPLE_ITEMS = {
    tee: { source: 'pod', label: 'shirt', title: 'Nobody Is Coming Tee', variant: 'Black / M', image: 'assets/demo-tee.jpg' },
    bag: { source: 'pod', label: 'gym bag', title: 'Iron blueprint', variant: 'Gym bag' },
    bottle: { source: 'pod', label: 'bottle', title: 'Hydrate then dominate', variant: 'Water bottle' },
    mug: { source: 'pod', label: 'mug', title: 'First coffee then conquer', variant: 'Mug' },
    journal: { source: 'pod', label: 'journal', title: 'Begin', variant: 'Journal' },
    suit: { source: 'stock', label: 'suit', title: 'The Navy Three-Piece Suit', variant: 'Navy / 40R' },
    pants: { source: 'stock', label: 'joggers', title: 'The Black Training Joggers', variant: 'Black / M' },
    shirt: { source: 'stock', label: 'dress shirt', title: 'Premium Non-Iron Dress Shirt', variant: 'White / M' },
    gymtee: { source: 'stock', kind: 'tee', label: 'gym tee', title: 'The Black Gym Tee', variant: 'Black / L' },
    shoes: { source: 'stock', label: 'shoes', title: 'Engraved Leather Brogue Shoes', variant: 'Black / 42' },
    tie: { source: 'stock', label: 'tie', title: 'Black Paisley Jacquard Tie Set', variant: 'Black' },
    socks: { source: 'stock', label: 'socks', title: 'Business Crew Socks (10 pairs)', variant: 'Mixed' },
    gear: { source: 'stock', label: 'gear', title: 'Grip Strength Trainer Kit', variant: 'Kit' },
    mixed: { label: 'mixed order' }
  };

  function sampleOrder(stage, key) {
    const now = Date.now();
    const placed = now - Math.max(stage, 0.2) * DAY;
    const tracking = { carrier: 'USPS', number: '9400 1000 0000 0000 0000 00', url: 'https://tools.usps.com/go/TrackConfirmAction', shippedAt: now - 0.3 * DAY };
    const part = (k, source) => {
      const { label, source: _s, kind, ...it } = SAMPLE_ITEMS[k];
      const last = PART[source].stages('item').length - 1;
      const done = stage >= last;
      return { source, status: done ? 'shipped' : 'in_production', tracking: done ? tracking : null, items: [{ ...it, qty: 1, kind: kind || k }] };
    };
    const groups = key === 'mixed' ? [part('tee', 'pod'), part('suit', 'stock')] : [part(key, SAMPLE_ITEMS[key].source)];
    return { number: '#1042', placed, groups };
  }

  function demo() {
    const params = new URLSearchParams(location.search);
    let key = SAMPLE_ITEMS[params.get('kind')] ? params.get('kind') : 'tee';
    let stage = Math.max(parseInt(params.get('stage') || '1', 10) || 0, 0);
    const bar = $('demo');
    const label = (text) => Object.assign(document.createElement('span'), { className: 'small-label', textContent: text });
    const button = (text, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', onClick);
      return b;
    };
    const stageBox = document.createElement('span');
    stageBox.className = 'demo__group';
    const kindButtons = Object.keys(SAMPLE_ITEMS).map((k) => button(SAMPLE_ITEMS[k].label, () => show(stage, k)));
    let moment = -1;
    const momentButtons = MOMENTS.map((m, i) => button('+' + (i + 1) + 'd', () => { moment = i; show(stage, key, i); }));
    bar.replaceChildren(label('Sample order'), stageBox, label('waiting'), ...momentButtons, label('/'), ...kindButtons);
    bar.hidden = false;

    function show(i, k, m = -1) {
      moment = m;
      const source = k === 'mixed' || SAMPLE_ITEMS[k].source === 'pod' ? 'pod' : 'stock';
      const labels = PART[source].stages('item');
      stage = m >= 0 ? labels.length - 2 : Math.min(i, labels.length - 1);
      key = k;
      stageBox.replaceChildren(...labels.map((st, j) => {
        const b = button(st.label, () => show(j, key));
        b.setAttribute('aria-pressed', String(j === stage && moment < 0));
        return b;
      }));
      kindButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(Object.keys(SAMPLE_ITEMS)[j] === k)));
      momentButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === moment)));
      render(sampleOrder(stage + (moment >= 0 ? moment + 1 : 0), k), 0, stage, moment >= 0 ? moment : undefined);
      history.replaceState(null, '', '?stage=' + stage + '&kind=' + k);
    }
    show(stage, key);
  }

  async function live(token) {
    try {
      // Local copies (wrangler dev) talk to their own backend; the live page uses the Worker address.
      const api = isLocal ? '' : (document.querySelector('meta[name="api-base"]').content || '').replace(/\/$/, '');
      const res = await fetch(api + '/api/order/' + encodeURIComponent(token), { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      const o = await res.json();
      // Open on the first part that has not shipped yet.
      const parts = partsOf(o);
      const open = parts.findIndex((p) => p.status !== 'shipped');
      render(o, open < 0 ? 0 : open);
    } catch (e) {
      $('err').hidden = false;
    }
  }

  // Visitors without an order link see a short note; the sample order shows only with ?demo (or locally).
  function noLink() {
    $('errTitle').textContent = 'Follow your order';
    $('errText').textContent = 'Open the "Follow your order" button in the email we sent you. It brings you straight to your order.';
    $('err').hidden = false;
  }

  const params = new URLSearchParams(location.search);
  const token = params.get('t');

  if (token) live(token);
  else if (params.has('demo') || params.has('stage') || isLocal) demo();
  else noLink();
})();