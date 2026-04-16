const STORAGE_KEYS = {
  reservations: 'er_reservations_v1',
  reviews: 'er_reviews_v1',
  externalReviews: 'er_external_reviews_v1',
  calendarCache: 'er_calendar_cache_v2',
};

/**
 * Edición de contenido: solo propietarios.
 * - Página dedicada: propietarios.html (escribir la clave y Entrar).
 * - O enlace con clave corta: ?p=romero (una vez por navegador).
 * Cambiá la clave aquí antes de publicar.
 */
const ER_OWNER_SESSION_KEY = 'er_owner_edit_v1';
const ER_OWNER_EDIT_SECRET = 'romero';

/** Fichas oficiales (reseñas reales en la plataforma) */
const LISTING_URL_BOOKING =
  'https://www.booking.com/hotel/ar/espaciosa-casa-en-pleno-centro-porteno.es-ar.html';
const LISTING_URL_AIRBNB = 'https://www.airbnb.com.ar/rooms/1640510292843045372';
const DEFAULT_CALENDAR_START_ISO = '2026-05-01';
const CALENDAR_FEEDS = [
  {
    name: 'Airbnb',
    publicUrl: LISTING_URL_AIRBNB,
    icsUrl: 'https://www.airbnb.com/calendar/ical/1664134541647466368.ics?t=d44ec18463d3431c91a761dc77f81947&locale=es-AR',
  },
  {
    name: 'Booking.com',
    publicUrl: LISTING_URL_BOOKING,
    icsUrl: '', // Agregar enlace iCal de Booking aquí
  },
];

const DEFAULT_EXTERNAL_REVIEWS = [
  {
    id: 'seed-ext-1',
    name: 'Huésped · Booking.com',
    rating: 5,
    comment:
      'Reseñas verificadas y puntuación global en la ficha del alojamiento en Booking.com. Abrí el enlace para leer opiniones reales de huéspedes.',
    source: 'Booking.com',
    link: LISTING_URL_BOOKING,
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'seed-ext-2',
    name: 'Huésped · Airbnb',
    rating: 5,
    comment:
      'Reseñas y evaluaciones de huéspedes en la publicación oficial de Airbnb. Enlace directo a la habitación/alojamiento.',
    source: 'Airbnb',
    link: LISTING_URL_AIRBNB,
    createdAt: '2026-02-03T15:00:00.000Z',
  },
];

function ensureExternalReviewsSeed() {
  const KEY = 'er_platform_listings_v2';
  let ext = getStoredList(STORAGE_KEYS.externalReviews);
  if (!Array.isArray(ext)) ext = [];

  if (!localStorage.getItem(KEY)) {
    ext = ext.filter(r => r && !['seed-ext-1', 'seed-ext-2'].includes(r.id));
    ext = ext.filter(r => {
      const l = String(r.link || '').trim();
      return l !== 'https://www.booking.com/' && l !== 'https://www.airbnb.com/';
    });
    setStoredList(STORAGE_KEYS.externalReviews, [...DEFAULT_EXTERNAL_REVIEWS, ...ext]);
    localStorage.setItem(KEY, '1');
    return;
  }

  if (ext.length === 0) {
    setStoredList(STORAGE_KEYS.externalReviews, DEFAULT_EXTERNAL_REVIEWS);
  }
}

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function getStoredList(key) {
  return safeJsonParse(localStorage.getItem(key), []);
}

function setStoredList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function toDateOnly(value) {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dateToIso(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateEs(iso) {
  const date = toDateOnly(iso);
  if (!date) return iso;
  // Forzar formato DD/MM/YYYY
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function overlapsRange(aStart, aEnd, bStart, bEnd) {
  const aS = toDateOnly(aStart);
  const aE = toDateOnly(aEnd);
  const bS = toDateOnly(bStart);
  const bE = toDateOnly(bEnd);
  if (!aS || !aE || !bS || !bE) return false;
  return aS < bE && aE > bS;
}

function isValidRange(startIso, endIso) {
  const s = toDateOnly(startIso);
  const e = toDateOnly(endIso);
  if (!s || !e) return false;
  return e > s;
}

function sortReservations(list) {
  return [...list].sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));
}

function renderReservationsList(list) {
  const el = document.getElementById('reservations-list');
  if (!el) return;
  const sorted = sortReservations(list).filter(r => isValidRange(r.checkin, r.checkout));

  if (sorted.length === 0) {
    el.innerHTML = '<div class="text-gray-500">No hay fechas ocupadas sincronizadas para mostrar.</div>';
    return;
  }

  el.innerHTML = sorted.slice(0, 10).map(r => {
    const source = r.source ? ` · ${escapeHtml(r.source)}` : '';
    return `<div class="flex items-start justify-between gap-3">
      <div class="text-gray-300">${formatDateEs(r.checkin)} → ${formatDateEs(r.checkout)}${source}</div>
      <div class="text-xs text-gray-600 uppercase tracking-widest">${r.source ? escapeHtml(r.source) : 'Sync'}</div>
    </div>`;
  }).join('');
}

function getReservationConflict(list, checkin, checkout) {
  return list.find(r => overlapsRange(checkin, checkout, r.checkin, r.checkout));
}

function setAvailabilityStatus({ type, text }) {
  const el = document.getElementById('availability-status');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('text-gray-300', 'text-green-400', 'text-red-400');
  if (type === 'ok') el.classList.add('text-green-400');
  if (type === 'error') el.classList.add('text-red-400');
  if (!type || type === 'info') el.classList.add('text-gray-300');
}

function setBookingError(text) {
  const el = document.getElementById('booking-error');
  if (!el) return;
  if (!text) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.classList.remove('hidden');
}

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function initializeImageFallbacks() {
  document.querySelectorAll('img[data-fallback]').forEach(img => {
    if (img.dataset.erFallbackBound) return;
    img.dataset.erFallbackBound = '1';
    const fallback = img.getAttribute('data-fallback');
    const src = img.getAttribute('src');
    if (!fallback || !src) return;
    loadImage(src).then(ok => {
      if (!ok) img.src = fallback;
    });
  });
}

async function initializeHeroBackground() {
  const hero = document.querySelector('.hero-gradient');
  if (!hero) return;
  const preferredLocalImages = ['img/foto2.jpeg', 'img/foto3.jpeg', 'img/foto1.jpeg', 'img/foto4.jpeg'];
  const gradient = 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75))';

  const loaded = await Promise.all(
    preferredLocalImages.map(async (src) => (await loadImage(src)) ? src : null)
  ).then(list => list.filter(Boolean));

  const existing = document.getElementById('hero-dynamic-style');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'hero-dynamic-style';

  if (loaded.length === 0) {
    style.textContent = `
      .hero-gradient { background-image: ${gradient}; }
      @keyframes heroSlider { 0%, 100% { background-image: ${gradient}; } }
    `;
    document.head.appendChild(style);
    return;
  }

  const images = Array.from({ length: 4 }, (_, i) => loaded[i % loaded.length]);
  style.textContent = `
    .hero-gradient { background-image: ${gradient}, url('${images[0]}'); }
    @keyframes heroSlider {
      0%, 20% { background-image: ${gradient}, url('${images[0]}'); }
      25%, 45% { background-image: ${gradient}, url('${images[1]}'); }
      50%, 70% { background-image: ${gradient}, url('${images[2]}'); }
      75%, 95% { background-image: ${gradient}, url('${images[3]}'); }
    }
  `;
  document.head.appendChild(style);
}

function unfoldIcsText(text) {
  return String(text || '').replace(/\r?\n[ \t]/g, '');
}

function parseIcsDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseIcsReservations(icsText, source) {
  const unfolded = unfoldIcsText(icsText);
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let current = null;

  lines.forEach((line) => {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      return;
    }
    if (line === 'END:VEVENT') {
      if (current?.checkin && current?.checkout && isValidRange(current.checkin, current.checkout)) {
        events.push({
          id: `${source}-${current.checkin}-${current.checkout}-${events.length}`,
          source,
          checkin: current.checkin,
          checkout: current.checkout,
        });
      }
      current = null;
      return;
    }
    if (!current) return;

    const startMatch = line.match(/^DTSTART[^:]*:(.+)$/);
    if (startMatch) {
      current.checkin = parseIcsDate(startMatch[1]);
      return;
    }
    const endMatch = line.match(/^DTEND[^:]*:(.+)$/);
    if (endMatch) {
      current.checkout = parseIcsDate(endMatch[1]);
    }
  });

  return events;
}

async function fetchCalendarFeedText(url) {
  const target = String(url || '').trim();
  if (!target) return '';

  const attempts = [
    target,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://r.jina.ai/http://${target.replace(/^https?:\/\//i, '')}`,
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text && text.includes('BEGIN:VCALENDAR')) return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No fue posible leer el calendario externo.');
}

function initializeBooking() {
  const checkinInput = document.getElementById('bk-checkin');
  const checkoutInput = document.getElementById('bk-checkout');
  const searchBtn = document.getElementById('availability-search-btn');
  const syncBtn = document.getElementById('calendar-refresh-btn');
  const syncStatusEl = document.getElementById('calendar-sync-status');
  const summaryEl = document.getElementById('availability-summary');
  const sourceListEl = document.getElementById('calendar-source-list');
  const resultsWrap = document.getElementById('availability-results');
  if (!checkinInput || !checkoutInput) return;

  const enabledFeeds = CALENDAR_FEEDS.filter(feed => String(feed.icsUrl || '').trim());
  const pendingFeeds = CALENDAR_FEEDS.filter(feed => !String(feed.icsUrl || '').trim());
  const calendarFeedSignature = enabledFeeds.map(feed => `${feed.name}:${feed.icsUrl}`).join('|');
  const today = new Date();
  const todayIso = dateToIso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
  const defaultStartIso = DEFAULT_CALENDAR_START_ISO;
  const defaultStartDate = toDateOnly(defaultStartIso);
  checkinInput.min = defaultStartIso;
  checkoutInput.min = defaultStartIso;

  const calendarContainer = document.getElementById('availability-calendar');
  const calendarWrap = document.getElementById('availability-calendar-wrap');
  const calendarHint = document.getElementById('calendar-hint');
  const calendarMonthLabel = document.getElementById('calendar-month-label');
  const calendarPrevBtn = document.getElementById('calendar-prev');
  const calendarNextBtn = document.getElementById('calendar-next');
  let calendarMonthDate = new Date(Date.UTC(2026, 4, 1)); // Mayo 2026
  let calendarMonthShouldAnimate = false;
  let reservations = [];
  renderReservationsList(reservations);

  function setCalendarToFeedStart(list) {
    // Forzamos siempre a Mayo 2026 al cargar
    calendarMonthDate = new Date(Date.UTC(2026, 4, 1));
  }

  if (sourceListEl) {
    sourceListEl.innerHTML = CALENDAR_FEEDS.map(feed => {
      const badgeClass = feed.icsUrl ? 'text-green-400 border-green-400/30 bg-green-400/10' : 'text-amber-300 border-amber-300/30 bg-amber-300/10';
      const statusText = feed.icsUrl ? 'Sincronizado' : 'Pendiente';
      const linkLabel = feed.name.includes('Booking') ? 'Abrir ficha' : 'Abrir anuncio';
      return `
        <div class="flex items-center justify-between gap-3 border border-zinc-800 rounded-xl px-4 py-3 bg-black/30">
          <div>
            <div class="text-sm font-semibold text-white">${escapeHtml(feed.name)}</div>
            <div class="text-xs text-gray-500">${feed.icsUrl ? 'Fechas ocupadas importadas al calendario.' : 'Listo para conectar cuando agregues el enlace iCal.'}</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${badgeClass}">${statusText}</span>
            <a href="${escapeAttr(feed.publicUrl)}" target="_blank" rel="noreferrer" class="text-xs uppercase tracking-widest text-gray-300 hover:text-brand-red transition">${linkLabel}</a>
          </div>
        </div>
      `;
    }).join('');
  }

  function setSyncStatus(type, text) {
    if (!syncStatusEl) return;
    syncStatusEl.textContent = text;
    syncStatusEl.classList.remove('text-gray-400', 'text-green-400', 'text-amber-300', 'text-red-400');
    if (type === 'ok') syncStatusEl.classList.add('text-green-400');
    else if (type === 'warn') syncStatusEl.classList.add('text-amber-300');
    else if (type === 'error') syncStatusEl.classList.add('text-red-400');
    else syncStatusEl.classList.add('text-gray-400');
  }

  function isBookedDay(iso, currentReservations) {
    const day = toDateOnly(iso);
    if (!day) return false;
    return currentReservations.some(r => {
      if (!isValidRange(r.checkin, r.checkout)) return false;
      const s = toDateOnly(r.checkin);
      const e = toDateOnly(r.checkout);
      return s && e ? (day >= s && day < e) : false;
    });
  }

  function daySelectionMeta(iso) {
    const ci = checkinInput?.value || '';
    const co = checkoutInput?.value || '';
    if (!ci) return { inRange: false, isStart: false, isEnd: false };
    if (!co || !isValidRange(ci, co)) {
      const on = iso === ci;
      return { inRange: on, isStart: on, isEnd: false };
    }
    const isStart = iso === ci;
    const isEnd = iso === co;
    const isMid = iso > ci && iso < co;
    return { inRange: isStart || isEnd || isMid, isStart, isEnd };
  }

  function triggerCalendarMonthAnimation() {
    if (!calendarWrap) return;
    calendarWrap.classList.remove('cal-month-slide');
    calendarWrap.getBoundingClientRect();
    calendarWrap.classList.add('cal-month-slide');
    const done = () => {
      calendarWrap.removeEventListener('animationend', done);
      calendarWrap.classList.remove('cal-month-slide');
    };
    calendarWrap.addEventListener('animationend', done, { once: true });
  }

  function handleCalendarDayClick(iso) {
    if (iso < defaultStartIso) return;
    if (isBookedDay(iso, reservations)) return;

    const ci = checkinInput.value;
    const co = checkoutInput.value;

    if (ci && co) {
      checkinInput.value = iso;
      checkoutInput.value = '';
      syncCheckoutMin();
      updateAvailability();
      return;
    }

    if (ci && !co) {
      if (iso <= ci) {
        checkinInput.value = iso;
        checkoutInput.value = '';
        syncCheckoutMin();
        updateAvailability();
        return;
      }
      checkoutInput.value = iso;
      syncCheckoutMin();
      updateAvailability();
      return;
    }

    checkinInput.value = iso;
    checkoutInput.value = '';
    syncCheckoutMin();
    updateAvailability();
  }

  function renderAvailabilityCalendar() {
    if (!calendarContainer || !calendarMonthLabel) return;
    calendarContainer.innerHTML = '';

    const year = calendarMonthDate.getUTCFullYear();
    const month = calendarMonthDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const totalDays = lastDay.getUTCDate();
    const startOffset = (firstDay.getUTCDay() + 6) % 7;

    calendarMonthLabel.textContent = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(firstDay);

    const gridDays = 42;
    for (let i = 0; i < gridDays; i += 1) {
      const dayIndex = i - startOffset + 1;
      const cellDate = new Date(Date.UTC(year, month, dayIndex));
      const inMonth = dayIndex >= 1 && dayIndex <= totalDays;
      const iso = dateToIso(cellDate);

      if (!inMonth) {
        const placeholder = document.createElement('div');
        placeholder.className = 'calendar-day is-outside';
        placeholder.textContent = '';
        placeholder.setAttribute('aria-hidden', 'true');
        calendarContainer.appendChild(placeholder);
        continue;
      }

      const booked = isBookedDay(iso, reservations);
      const past = iso < defaultStartIso;
      const { inRange, isStart, isEnd } = daySelectionMeta(iso);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.style.setProperty('--cal-i', String(i));
      cell.textContent = String(cellDate.getUTCDate());
      cell.setAttribute('role', 'gridcell');

      if (booked) {
        cell.className = 'calendar-day is-booked';
        cell.disabled = true;
        cell.setAttribute('aria-label', `Ocupado ${formatDateEs(iso)}`);
      } else if (past) {
        cell.className = 'calendar-day is-past';
        cell.disabled = true;
        cell.setAttribute('aria-label', `Pasado ${formatDateEs(iso)}`);
      } else {
        cell.className = 'calendar-day is-available';
        if (inRange) {
          cell.classList.add('is-range');
          if (isStart) cell.classList.add('is-range-start');
          if (isEnd) cell.classList.add('is-range-end');
        }
        cell.setAttribute('aria-label', `Elegir ${formatDateEs(iso)}`);
        cell.addEventListener('click', () => handleCalendarDayClick(iso));
      }
      calendarContainer.appendChild(cell);
    }

    if (calendarMonthShouldAnimate) {
      calendarMonthShouldAnimate = false;
      requestAnimationFrame(() => triggerCalendarMonthAnimation());
    }
  }

  function syncCheckoutMin() {
    if (!checkinInput.value) {
      checkoutInput.min = todayIso;
      return;
    }
    const checkinDate = toDateOnly(checkinInput.value);
    if (!checkinDate) return;
    const minCheckout = new Date(checkinDate.getTime());
    minCheckout.setUTCDate(minCheckout.getUTCDate() + 1);
    const minIso = dateToIso(minCheckout);
    checkoutInput.min = minIso;
    if (checkoutInput.value && !isValidRange(checkinInput.value, checkoutInput.value)) {
      checkoutInput.value = '';
    }
  }

  function updateAvailability() {
    const checkin = checkinInput.value || '';
    const checkout = checkoutInput.value || '';
    if (calendarHint) {
      if (!checkin) {
        calendarHint.innerHTML = 'Tocá el día de <strong class="text-white">entrada</strong> y después el de <strong class="text-white">salida</strong>. Las fechas ocupadas se bloquean automáticamente.';
      } else if (!checkout) {
        calendarHint.innerHTML = 'Elegí el día de <strong class="text-white">salida</strong> para terminar la búsqueda.';
      } else {
        calendarHint.innerHTML = 'Podés tocar otra fecha de <strong class="text-white">entrada</strong> para cambiar el rango.';
      }
    }
    if (!checkin || !checkout) {
      setAvailabilityStatus({ type: 'info', text: 'Seleccioná fechas para consultar disponibilidad.' });
      if (summaryEl) summaryEl.textContent = 'Elegí una fecha de entrada y otra de salida para verificar si el rango aparece libre en el calendario sincronizado.';
      renderAvailabilityCalendar();
      return;
    }
    if (!isValidRange(checkin, checkout)) {
      setAvailabilityStatus({ type: 'error', text: 'La fecha de salida debe ser posterior a la llegada.' });
      if (summaryEl) summaryEl.textContent = 'Revisá las fechas: la salida tiene que ser posterior a la entrada.';
      renderAvailabilityCalendar();
      return;
    }
    const conflict = getReservationConflict(reservations, checkin, checkout);
    if (conflict) {
      setAvailabilityStatus({ type: 'error', text: 'No disponible en esas fechas.' });
      if (summaryEl) {
        summaryEl.textContent = `El rango ${formatDateEs(checkin)} a ${formatDateEs(checkout)} aparece ocupado en ${conflict.source || 'el calendario sincronizado'}.`;
      }
      renderAvailabilityCalendar();
      return;
    }
    setAvailabilityStatus({ type: 'ok', text: 'Disponible en el calendario sincronizado.' });
    if (summaryEl) {
      summaryEl.textContent = `El rango ${formatDateEs(checkin)} a ${formatDateEs(checkout)} figura libre en la sincronización actual. Verificá y completá la reserva en Airbnb o Booking.com.`;
    }
    renderAvailabilityCalendar();
  }

  async function syncExternalCalendars() {
    if (enabledFeeds.length === 0) {
      reservations = [];
      renderReservationsList(reservations);
      renderAvailabilityCalendar();
      updateAvailability();
      setSyncStatus('warn', 'No hay calendarios iCal configurados todavía. El calendario muestra disponibilidad general.');
      return;
    }

    if (syncBtn) {
      syncBtn.setAttribute('disabled', 'true');
      syncBtn.classList.add('opacity-70');
      syncBtn.innerHTML = 'Sincronizando <i class="fas fa-circle-notch fa-spin"></i>';
    }

    setSyncStatus('info', 'Actualizando disponibilidad desde los calendarios externos...');

    try {
      const fetchedLists = await Promise.all(
        enabledFeeds.map(async (feed) => {
          const text = await fetchCalendarFeedText(feed.icsUrl);
          return parseIcsReservations(text, feed.name);
        })
      );

      reservations = fetchedLists
        .flat()
        .filter(item => item && isValidRange(item.checkin, item.checkout))
        .sort((a, b) => (a.checkin || '').localeCompare(b.checkin || ''));

      setCalendarToFeedStart(reservations);

      localStorage.setItem(
        STORAGE_KEYS.calendarCache,
        JSON.stringify({
          feedSignature: calendarFeedSignature,
          syncedAt: new Date().toISOString(),
          reservations,
        })
      );

      renderReservationsList(reservations);
      renderAvailabilityCalendar();
      updateAvailability();

      const syncedNames = enabledFeeds.map(feed => feed.name).join(', ');
      if (pendingFeeds.length > 0) {
        setSyncStatus('warn', `Calendario actualizado desde ${syncedNames}. Pendiente conectar: ${pendingFeeds.map(feed => feed.name).join(', ')}.`);
      } else {
        setSyncStatus('ok', `Calendario actualizado desde ${syncedNames}.`);
      }
    } catch (error) {
      const cached = safeJsonParse(localStorage.getItem(STORAGE_KEYS.calendarCache), { reservations: [] });
      const cachedMatchesFeed = cached?.feedSignature === calendarFeedSignature;
      reservations = cachedMatchesFeed && Array.isArray(cached.reservations) ? cached.reservations : [];
      renderReservationsList(reservations);
      renderAvailabilityCalendar();
      updateAvailability();
      if (reservations.length > 0) {
        setSyncStatus('warn', 'No se pudo refrescar el calendario en este momento. Se muestran las últimas fechas sincronizadas guardadas en este navegador.');
      } else {
        setSyncStatus('error', 'No se pudo cargar la disponibilidad externa. Revisá el enlace iCal o intentá nuevamente.');
      }
      console.error('Calendar sync error:', error);
    } finally {
      if (syncBtn) {
        syncBtn.removeAttribute('disabled');
        syncBtn.classList.remove('opacity-70');
        syncBtn.innerHTML = 'Actualizar calendario';
      }
    }
  }

  checkinInput.addEventListener('change', () => {
    syncCheckoutMin();
    updateAvailability();
  });
  checkoutInput.addEventListener('change', updateAvailability);
  searchBtn?.addEventListener('click', updateAvailability);
  syncBtn?.addEventListener('click', syncExternalCalendars);

  if (resultsWrap) {
    resultsWrap.classList.remove('hidden');
  }

  calendarPrevBtn?.addEventListener('click', () => {
    const minMonthDate = new Date(Date.UTC(defaultStartDate.getUTCFullYear(), defaultStartDate.getUTCMonth(), 1));

    const targetDate = new Date(Date.UTC(calendarMonthDate.getUTCFullYear(), calendarMonthDate.getUTCMonth() - 1, 1));
    if (targetDate < minMonthDate) return;

    calendarMonthShouldAnimate = true;
    calendarMonthDate = targetDate;
    renderAvailabilityCalendar();
  });
  calendarNextBtn?.addEventListener('click', () => {
    calendarMonthShouldAnimate = true;
    calendarMonthDate = new Date(Date.UTC(calendarMonthDate.getUTCFullYear(), calendarMonthDate.getUTCMonth() + 1, 1));
    renderAvailabilityCalendar();
  });

  const cached = safeJsonParse(localStorage.getItem(STORAGE_KEYS.calendarCache), { reservations: [] });
  const cachedMatchesFeed = cached?.feedSignature === calendarFeedSignature;
  if (!cachedMatchesFeed && localStorage.getItem(STORAGE_KEYS.calendarCache)) {
    localStorage.removeItem(STORAGE_KEYS.calendarCache);
  }
  if (cachedMatchesFeed && Array.isArray(cached.reservations) && cached.reservations.length > 0) {
    reservations = cached.reservations;
    setCalendarToFeedStart(reservations);
    renderReservationsList(reservations);
    setSyncStatus('warn', 'Mostrando la última sincronización guardada mientras se actualiza el calendario.');
  } else if (pendingFeeds.length > 0) {
    setSyncStatus('warn', `Calendario listo. Pendiente conectar: ${pendingFeeds.map(feed => feed.name).join(', ')}.`);
  } else {
    setSyncStatus('info', 'Calendario listo para sincronizar.');
  }

  renderAvailabilityCalendar();
  syncCheckoutMin();
  if (!checkinInput.value && defaultStartIso >= todayIso) {
    checkinInput.value = defaultStartIso;
    syncCheckoutMin();
  }
  if (summaryEl) {
    summaryEl.textContent = enabledFeeds.length > 0
      ? 'Consultá un rango para ver si aparece libre según el calendario sincronizado. Luego podés continuar la reserva en las plataformas oficiales.'
      : 'El calendario está preparado, pero todavía necesita al menos un enlace iCal para mostrar disponibilidad real.';
  }
  updateAvailability();
  syncExternalCalendars();
}

function setReviewError(text) {
  const el = document.getElementById('review-error');
  if (!el) return;
  if (!text) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.classList.remove('hidden');
}

function setReviewSuccess(visible) {
  const el = document.getElementById('review-success');
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function uploadToSupabase(file) {
  const url = localStorage.getItem('er_supabase_url') || '';
  const key = localStorage.getItem('er_supabase_key') || '';
  const bucket = localStorage.getItem('er_supabase_bucket') || 'images';

  if (!url || !key) {
    const newUrl = window.prompt('Para usar Supabase, ingresá la URL de tu proyecto:', url);
    const newKey = window.prompt('Ingresá tu Anon Key de Supabase:', key);
    if (newUrl && newKey) {
      localStorage.setItem('er_supabase_url', newUrl);
      localStorage.setItem('er_supabase_key', newKey);
      localStorage.setItem('er_supabase_bucket', bucket);
    } else {
      throw new Error('Configuración de Supabase incompleta.');
    }
  }

  const sUrl = localStorage.getItem('er_supabase_url').replace(/\/$/, '');
  const sKey = localStorage.getItem('er_supabase_key');
  const sBucket = localStorage.getItem('er_supabase_bucket');
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const filePath = `${fileName}`; // Subir a la raíz del bucket para evitar carpetas anidadas innecesarias

  const res = await fetch(`${sUrl}/storage/v1/object/${sBucket}/${filePath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sKey}`,
      'apikey': sKey,
      'Content-Type': file.type
    },
    body: file
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al subir a Supabase');

  return `${sUrl}/storage/v1/object/public/${sBucket}/${filePath}`;
}

async function saveJsonToSupabase(fileName, content) {
  const sUrl = (localStorage.getItem('er_supabase_url') || '').replace(/\/$/, '');
  const sKey = localStorage.getItem('er_supabase_key');
  const sBucket = localStorage.getItem('er_supabase_bucket');
  
  if (!sUrl || !sKey) {
    throw new Error('Faltan configurar las credenciales de Supabase (URL o Key).');
  }

  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const filePath = `${fileName}`;

  // Subir con x-upsert para sobrescribir el anterior
  try {
    const res = await fetch(`${sUrl}/storage/v1/object/${sBucket}/${filePath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sKey}`,
        'apikey': sKey,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      body: blob
    });
    if (!res.ok) {
      const txt = await res.text();
      if (txt.includes('row-level security policy')) {
        throw new Error('Error de Seguridad (RLS): El bucket de Supabase no permite sobrescribir archivos. Debes habilitar las políticas de INSERT y UPDATE para usuarios anónimos en el panel de Supabase.');
      }
      throw new Error(`Supabase Error: ${res.status} ${txt}`);
    }
  } catch (err) {
    console.error(`Error saving ${fileName} to Supabase:`, err);
    throw err;
  }
}

async function loadJsonFromSupabase(fileName) {
  const sUrl = (localStorage.getItem('er_supabase_url') || '').replace(/\/$/, '');
  const sBucket = localStorage.getItem('er_supabase_bucket');
  if (!sUrl || !sBucket) return null;

  try {
    // Agregamos un timestamp para evitar cache del navegador y ver cambios al instante
    const res = await fetch(`${sUrl}/storage/v1/object/public/${sBucket}/${fileName}?t=${Date.now()}`, { 
      cache: 'no-store',
      headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' }
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn(`No se pudo cargar ${fileName} de Supabase, usando local/fallback.`);
  }
  return null;
}

window.saveJsonToSupabase = saveJsonToSupabase;
window.loadJsonFromSupabase = loadJsonFromSupabase;

function sanitizeLink(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return '';
}

function highlightStars(container, val) {
  const stars = Array.from(container.querySelectorAll('i[data-value]'));
  stars.forEach(s => {
    const sVal = Number(s.getAttribute('data-value'));
    if (sVal <= val) {
      s.classList.remove('text-gray-600', 'far');
      s.classList.add('text-brand-red', 'fas');
    } else {
      s.classList.remove('text-brand-red', 'fas');
      s.classList.add('text-gray-600', 'fas');
    }
  });
}

function buildReviewCard({ name, rating, comment, createdAt, source, link }) {
  const safeName = String(name || '').trim() || 'Anónimo';
  const safeComment = String(comment || '').trim();
  const r = Math.min(5, Math.max(1, Number(rating || 5)));
  const starHtml = Array.from({ length: 5 }, (_, i) => `<i class="${i < r ? 'fas' : 'far'} fa-star"></i>`).join('');
  const dateLabel = createdAt ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(createdAt)) : 'Reciente';
  const initial = safeName[0] ? safeName[0].toUpperCase() : 'A';
  const sourceLabel = source ? String(source) : '';
  const safeLink = sanitizeLink(link);
  const badge = sourceLabel ? `<span class="text-xs uppercase tracking-widest text-gray-500 ml-2">${escapeHtml(sourceLabel)}</span>` : '';
  const srcLower = sourceLabel.toLowerCase();
  let linkLabel = 'Ver ficha';
  if (srcLower.includes('booking')) linkLabel = 'Ver en Booking';
  else if (srcLower.includes('airbnb')) linkLabel = 'Ver en Airbnb';
  const linkHtml = safeLink
    ? `<a href="${safeLink}" target="_blank" rel="noreferrer" class="text-xs text-gray-400 hover:text-brand-red transition ml-auto shrink-0">${escapeHtml(linkLabel)}</a>`
    : '';

  const el = document.createElement('div');
  el.className = 'bg-brand-black p-8 border-t-2 border-brand-red';
  el.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="flex text-brand-red mb-4">${starHtml}</div>
      ${badge}
      ${linkHtml}
    </div>
    <p class="italic mb-6 text-gray-300">"${escapeHtml(safeComment)}"</p>
    <div class="flex items-center gap-4">
      <div class="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center font-bold">${escapeHtml(initial)}</div>
      <div>
        <h4 class="font-bold">${escapeHtml(safeName)}</h4>
        <p class="text-xs text-gray-500">${escapeHtml(dateLabel)}</p>
      </div>
    </div>
  `;
  return el;
}

function renderStoredReviews() {
  const reviewsContainer = document.getElementById('reviews-container');
  if (!reviewsContainer) return;
  const internal = getStoredList(STORAGE_KEYS.reviews);
  const external = getStoredList(STORAGE_KEYS.externalReviews);

  const all = [
    ...external.map(r => ({ ...r, source: r.source || 'Verificada' })),
    ...internal.map(r => ({ ...r, source: r.source || '' })),
  ]
    .filter(r => r && String(r.comment || '').trim())
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 18);

  reviewsContainer.innerHTML = '';
  all.forEach(r => {
    const card = buildReviewCard(r);
    reviewsContainer.appendChild(card);
  });
}

function initializeReviews() {
  const reviewForm = document.getElementById('review-form');
  const reviewsContainer = document.getElementById('reviews-container');
  const submitBtn = document.getElementById('review-submit');
  const starContainer = document.getElementById('star-rating');
  const ratingInput = document.getElementById('rev-rating');
  const ratingLabel = document.getElementById('rating-label');
  if (!reviewForm || !reviewsContainer || !starContainer || !ratingInput) return;

  ensureExternalReviewsSeed();

  ratingInput.value = ratingInput.value || 5;
  highlightStars(starContainer, Number(ratingInput.value || 5));
  if (ratingLabel) ratingLabel.textContent = `${ratingInput.value}/5`;

  Array.from(starContainer.querySelectorAll('i[data-value]')).forEach(star => {
    star.addEventListener('mouseover', () => {
      const val = Number(star.getAttribute('data-value'));
      highlightStars(starContainer, val);
      if (ratingLabel) ratingLabel.textContent = `${val}/5`;
    });
    star.addEventListener('click', () => {
      const val = Number(star.getAttribute('data-value'));
      ratingInput.value = String(val);
      highlightStars(starContainer, val);
      if (ratingLabel) ratingLabel.textContent = `${val}/5`;
    });
  });

  starContainer.addEventListener('mouseleave', () => {
    const val = Number(ratingInput.value || 5);
    highlightStars(starContainer, val);
    if (ratingLabel) ratingLabel.textContent = `${val}/5`;
  });

  renderStoredReviews();

  reviewForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setReviewError('');
    setReviewSuccess(false);

    if (submitBtn) {
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.classList.add('opacity-80');
      submitBtn.innerHTML = 'Publicando <i class="fas fa-circle-notch fa-spin"></i>';
    }

    const name = String(document.getElementById('rev-name')?.value || '').trim();
    const rating = Number(ratingInput.value || 5);
    const comment = String(document.getElementById('rev-comment')?.value || '').trim();

    if (!comment) {
      setReviewError('Escribí tu reseña antes de publicar.');
      if (submitBtn) {
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'PUBLICAR RESEÑA';
      }
      return;
    }
    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      setReviewError('Seleccioná una calificación válida (1 a 5).');
      if (submitBtn) {
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'PUBLICAR RESEÑA';
      }
      return;
    }

    const review = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: name || 'Anónimo',
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };

    const current = getStoredList(STORAGE_KEYS.reviews);
    const next = [review, ...current].slice(0, 50);
    setStoredList(STORAGE_KEYS.reviews, next);
    renderStoredReviews();

    reviewForm.reset();
    ratingInput.value = 5;
    highlightStars(starContainer, 5);
    if (ratingLabel) ratingLabel.textContent = '5/5';
    setReviewSuccess(true);
    setTimeout(() => setReviewSuccess(false), 2500);

    if (submitBtn) {
      submitBtn.removeAttribute('disabled');
      submitBtn.classList.remove('opacity-80');
      submitBtn.innerHTML = 'PUBLICAR RESEÑA';
    }
  });

  const externalForm = document.getElementById('external-review-form');
  if (externalForm) {
    externalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = String(document.getElementById('ext-name')?.value || '').trim();
      const rating = Number(document.getElementById('ext-rating')?.value || 5);
      const comment = String(document.getElementById('ext-comment')?.value || '').trim();
      const source = String(document.getElementById('ext-source')?.value || '').trim();
      const link = String(document.getElementById('ext-link')?.value || '').trim();
      if (!comment) return;
      if (Number.isNaN(rating) || rating < 1 || rating > 5) return;

      const review = {
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: name || 'Anónimo',
        rating,
        comment,
        source,
        link: link || '',
        createdAt: new Date().toISOString(),
      };
      const current = getStoredList(STORAGE_KEYS.externalReviews);
      const next = [review, ...current].slice(0, 100);
      setStoredList(STORAGE_KEYS.externalReviews, next);
      externalForm.reset();
      renderStoredReviews();
    });
  }
}

function initializeStore() {
  const modal = document.getElementById('product-modal');
  const titleEl = document.getElementById('modal-product-title');
  const descEl = document.getElementById('modal-product-desc');
  const priceEl = document.getElementById('modal-product-price');
  const imgEl = document.getElementById('modal-img');
  const catalogSection = document.getElementById('modal-catalog');
  const catalogList = document.getElementById('modal-catalog-list');
  if (!modal || !titleEl || !descEl || !priceEl || !imgEl || !catalogSection || !catalogList) return;

  function getProducts() {
    const st = window.getStoreState?.();
    if (st && Array.isArray(st.products) && st.products.length) {
      return st.products
        .map(p => ({
          title: p.title,
          price: p.price,
          img: p.image,
          desc: p.desc,
        }))
        .filter(p => p.title && p.img);
    }
    return Array.from(document.querySelectorAll('.product-detail-btn')).map(btn => ({
      title: btn.getAttribute('data-title') || '',
      price: btn.getAttribute('data-price') || '',
      img: btn.getAttribute('data-img') || '',
      desc: btn.getAttribute('data-desc') || '',
    })).filter(p => p.title && p.img);
  }

  function setModalOpen(open) {
    modal.classList.toggle('hidden', !open);
    document.body.classList.toggle('overflow-hidden', open);
  }

  function openProduct(product, withCatalog) {
    titleEl.textContent = product.title;
    descEl.textContent = product.desc;
    priceEl.textContent = product.price;
    imgEl.src = product.img;
    imgEl.alt = product.title;

    if (withCatalog) {
      const products = getProducts();
      catalogList.innerHTML = products.map(p => `
        <button type="button" class="text-left border border-zinc-800 bg-black hover:border-brand-red transition p-3">
          <div class="text-sm font-semibold text-white">${p.title}</div>
          <div class="text-xs text-gray-400 mt-1">${p.price}</div>
        </button>
      `).join('');
      Array.from(catalogList.querySelectorAll('button')).forEach((b, idx) => {
        b.addEventListener('click', () => openProduct(products[idx], true));
      });
      catalogSection.classList.remove('hidden');
    } else {
      catalogSection.classList.add('hidden');
      catalogList.innerHTML = '';
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    catalogSection.classList.add('hidden');
    catalogList.innerHTML = '';
    imgEl.removeAttribute('src');
    imgEl.alt = '';
  }

  document.addEventListener('click', (e) => {
    const detailBtn = e.target.closest('.product-detail-btn');
    if (detailBtn) {
      const product = {
        title: detailBtn.getAttribute('data-title') || '',
        price: detailBtn.getAttribute('data-price') || '',
        img: detailBtn.getAttribute('data-img') || '',
        desc: detailBtn.getAttribute('data-desc') || '',
      };
      openProduct(product, false);
      return;
    }

    if (e.target.closest('[data-modal-close]')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

function ensureOwnerEditSessionFromUrl() {
  const params = new URLSearchParams(location.search);
  const key = params.get('propietario') || params.get('edit') || params.get('p') || params.get('clave');
  if (!key || key !== ER_OWNER_EDIT_SECRET) return;
  sessionStorage.setItem(ER_OWNER_SESSION_KEY, '1');
  params.delete('propietario');
  params.delete('edit');
  params.delete('p');
  params.delete('clave');
  const qs = params.toString();
  const newUrl = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  history.replaceState({}, '', newUrl);
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, ' ');
}

function buildProductCardEl(p, index = 0) {
  const div = document.createElement('div');
  div.className = 'product-card-glass overflow-hidden group store-item-enter';
  div.style.setProperty('--stagger', index);
  div.innerHTML = `
    <div class="relative overflow-hidden">
      <img src="${escapeAttr(p.image)}" data-fallback="foto1.jpeg" alt="${escapeAttr(p.title)}" class="w-full h-56 object-cover group-hover:scale-110 transition duration-700">
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-500 flex items-center justify-center">
        <button type="button" class="bg-brand-red text-white px-8 py-3 font-bold product-detail-btn shadow-xl hover:bg-brand-dark-red"
          data-title="${escapeAttr(p.title)}"
          data-price="${escapeAttr(p.price)}"
          data-img="${escapeAttr(p.image)}"
          data-desc="${escapeAttr(p.desc)}">${escapeHtml(p.btnLabel)}</button>
      </div>
    </div>
    <div class="p-5">
      <h2 class="font-bold text-xl mb-1">${escapeHtml(p.title)}</h2>
      <p class="text-white/60 text-sm italic">${escapeHtml(p.subtitle)}</p>
    </div>
  `;
  return div;
}

function sectionSelectOptionsMarkup(prod, sections) {
  return sections
    .map(
      s =>
        `<option value="${escapeAttr(s.id)}" ${prod.sectionId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
    )
    .join('');
}

function renderStoreProductGrid(grid) {
  if (!grid) return;
  const st = window.getStoreState?.();
  if (!st) return;
  const products = st.products || [];
  const sections = [...(st.sections || [])].sort((a, b) => a.order - b.order);
  
  const hash = window.location.hash;
  const activeSectionId = hash.startsWith('#tienda-') ? hash.replace('#tienda-', '') : (sections[0]?.id || null);
  
  grid.innerHTML = '';

  // 1. Renderizar Barra de Navegación de la Tienda (Tabs)
  if (sections.length > 1) {
    const nav = document.createElement('div');
    nav.className = 'flex flex-wrap justify-center gap-4 mb-16 border-b border-zinc-800 pb-8 reveal';
    nav.innerHTML = sections.map(sec => `
      <a href="#tienda-${sec.id}" class="px-6 py-3 rounded-full border-2 transition-all duration-300 uppercase tracking-widest text-xs font-bold ${activeSectionId === sec.id ? 'bg-brand-red border-brand-red text-white shadow-lg shadow-brand-red/30 scale-110' : 'border-zinc-700 text-gray-400 hover:border-white hover:text-white'}">
        ${escapeHtml(sec.name)}
      </a>
    `).join('');
    grid.appendChild(nav);
  }
  
  const sectionsToShow = activeSectionId 
    ? sections.filter(s => s.id === activeSectionId) 
    : [sections[0]].filter(Boolean);

  let globalIdx = 0;
  sectionsToShow.forEach(sec => {
    const secProds = products.filter(p => p.sectionId === sec.id);
    const wrap = document.createElement('section');
    wrap.id = `tienda-${sec.id}`;
    wrap.className = 'store-section reveal animate-fade-in';
    
    const h = document.createElement('h2');
    h.className = 'store-section-title text-3xl font-serif font-bold tracking-widest text-brand-red mb-10 pb-4 text-center';
    h.textContent = sec.name;
    wrap.appendChild(h);

    const subGrid = document.createElement('div');
    subGrid.className = 'grid sm:grid-cols-2 lg:grid-cols-4 gap-8';
    
    if (secProds.length > 0) {
      secProds.forEach(p => {
        subGrid.appendChild(buildProductCardEl(p, globalIdx));
        globalIdx++;
      });
    } else {
      subGrid.innerHTML = '<div class="col-span-full text-gray-600 italic py-12 border border-dashed border-zinc-800 rounded-lg text-center">Esta sección todavía no tiene productos.</div>';
    }
    
    wrap.appendChild(subGrid);
    grid.appendChild(wrap);
  });
  
  initializeImageFallbacks();
  initializeReveal(); // Re-inicializar para las nuevas secciones
}

function renderCatalogoPage(root) {
  if (!root) return;
  const st = window.getStoreState?.();
  if (!st) return;
  const products = st.products || [];
  const sections = [...(st.sections || [])].sort((a, b) => a.order - b.order);
  root.innerHTML = '';
  
  let globalIdx = 0;
  sections.forEach(sec => {
    const secProds = products.filter(p => p.sectionId === sec.id);
    const wrap = document.createElement('section');
    wrap.className = 'catalogo-section mb-16 md:mb-24';
    const head = document.createElement('div');
    head.className = 'flex flex-wrap items-baseline gap-4 mb-8 store-section-title pb-4';
    head.innerHTML = `
      <h2 class="text-3xl md:text-4xl font-serif font-bold text-white">${escapeHtml(sec.name)}</h2>
      <span class="text-sm text-gray-500 uppercase tracking-widest">${secProds.length} ${secProds.length === 1 ? 'pieza' : 'piezas'}</span>
    `;
    wrap.appendChild(head);

    const subGrid = document.createElement('div');
    subGrid.className = 'grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8';
    
    if (secProds.length > 0) {
      secProds.forEach(p => {
        subGrid.appendChild(buildProductCardEl(p, globalIdx));
        globalIdx++;
      });
    } else {
      subGrid.innerHTML = '<div class="col-span-full text-gray-600 italic py-12 border border-dashed border-zinc-800 rounded-lg text-center">Todavía no hay obras en esta categoría.</div>';
    }
    
    wrap.appendChild(subGrid);
    root.appendChild(wrap);
  });
  initializeImageFallbacks();
}

function syncTiendaFromState() {
  const st = window.getStoreState?.();
  if (!st) return;
  const h1 = document.querySelector('[data-edit-key="tienda_titulo"]');
  const p = document.querySelector('[data-edit-key="tienda_subtitulo"]');
  if (h1) h1.textContent = st.titulo;
  if (p) p.textContent = st.subtitulo;
  renderStoreProductGrid(document.getElementById('store-grid'));
  renderCatalogoPage(document.getElementById('catalogo-root'));
}

function persistTiendaHeader(titulo, subtitulo) {
  const pageKey = `er_editable_${location.pathname.split('/').pop() || 'page'}`;
  const prev = safeJsonParse(localStorage.getItem(pageKey), {});
  prev.tienda_titulo = titulo;
  prev.tienda_subtitulo = subtitulo;
  localStorage.setItem(pageKey, JSON.stringify(prev));
  const h1 = document.querySelector('[data-edit-key="tienda_titulo"]');
  const p = document.querySelector('[data-edit-key="tienda_subtitulo"]');
  if (h1) h1.textContent = titulo;
  if (p) p.textContent = subtitulo;
}

function renderDynamicNavMenu() {
  const st = window.getStoreState?.();
  if (!st || !st.sections) return;

  const sections = [...st.sections].sort((a, b) => a.order - b.order);
  
  // 1. Dropdown Desktop
  const desktopContainer = document.querySelector('.nav-dropdown > div');
  if (desktopContainer) {
    const sectionHtml = sections.map(sec => `
      <a href="./tienda.html#tienda-${sec.id}" class="block text-xs uppercase tracking-widest text-gray-200 hover:bg-brand-red/10 hover:text-brand-red">${escapeHtml(sec.name)}</a>
    `).join('');
    
    desktopContainer.innerHTML = `
      ${sectionHtml}
      <a href="./catalogo.html" class="block text-xs uppercase tracking-widest text-gray-200 hover:bg-brand-red/10 hover:text-brand-red border-t border-zinc-800">Catálogo completo</a>
    `;
  }

  // 2. Mobile Menu
  const mobileContainer = document.querySelector('#mobile-menu .pl-4');
  if (mobileContainer) {
    const sectionHtml = sections.map(sec => `
      <a href="./tienda.html#tienda-${sec.id}" class="hover:text-white transition">${escapeHtml(sec.name)}</a>
    `).join('');
    
    mobileContainer.innerHTML = `
      ${sectionHtml}
      <a href="./catalogo.html" class="hover:text-white transition">Catálogo completo</a>
    `;
  }
}

function initializeTiendaStorePage() {
  const grid = document.getElementById('store-grid');
  if (!grid && !document.querySelector('.nav-dropdown')) return;
  
  const updateAll = () => {
    syncTiendaFromState();
    renderDynamicNavMenu();
  };

  updateAll();
  document.addEventListener('er-store-update', updateAll);
  
  // Escuchar cambios en el hash para filtrar secciones sin recargar
  window.addEventListener('hashchange', () => {
    if (grid) renderStoreProductGrid(grid);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initializeCatalogoPage() {
  if (!document.getElementById('catalogo-root')) return;
  syncTiendaFromState();
  document.addEventListener('er-store-update', () => syncTiendaFromState());
}

function initializePropietariosLogin() {
  const form = document.getElementById('propietarios-form');
  if (!form) return;
  const err = document.getElementById('propietarios-error');
  const inputClave = document.getElementById('propietarios-clave');

  const handleLocalLogin = (e) => {
    if (e) e.preventDefault();
    err?.classList.add('hidden');
    const v = String(inputClave?.value || '').trim();
    if (v === ER_OWNER_EDIT_SECRET) {
      sessionStorage.setItem(ER_OWNER_SESSION_KEY, '1');
      // Redirigir a la tienda o a la última página editada
      window.location.href = './tienda.html';
      return;
    }
    err?.classList.remove('hidden');
    if (err) err.textContent = 'Clave secreta incorrecta.';
  };

  form.addEventListener('submit', handleLocalLogin);
}

function openTiendaStoreAdmin() {
  const base = window.getStoreState?.() || window.normalizeStoreState({});
  let sections = (base.sections || []).map(s => ({ ...s }));
  let products = (base.products || []).map(p => ({ ...p }));
  let titulo = base.titulo || 'Tienda de Arte';
  let subtitulo = base.subtitulo || '';

  const overlay = document.createElement('div');
  overlay.id = 'er-tienda-admin-overlay';
  overlay.className = 'fixed inset-0 z-[200] bg-black/95 overflow-y-auto p-4';
  document.body.appendChild(overlay);

  const normProd = window.normalizeStoreProduct;
  const normSec = window.normalizeStoreSection;

  function snapshotFromInputs() {
    titulo = String(overlay.querySelector('#er-tienda-titulo')?.value || '').trim() || 'Tienda de Arte';
    subtitulo = String(overlay.querySelector('#er-tienda-sub')?.value || '').trim();
    const secBlocks = Array.from(overlay.querySelectorAll('.er-sec'));
    sections = secBlocks.map((block, i) =>
      normSec({
        id: String(block.querySelector('.er-sec-id')?.value || '').trim() || `sec-${i}`,
        name: block.querySelector('.er-sec-name')?.value,
        order: Number(block.querySelector('.er-sec-order')?.value) || i,
      })
    );
    const pBlocks = Array.from(overlay.querySelectorAll('.er-prod'));
    const prevProducts = products;
    const next = [];
    pBlocks.forEach((block, i) => {
      next.push(
        normProd({
          id: prevProducts[i]?.id || `p-${Date.now()}-${i}`,
          sectionId: String(block.querySelector('.er-inp-section')?.value || sections[0]?.id || 'obras'),
          title: block.querySelector('.er-inp-title')?.value,
          subtitle: block.querySelector('.er-inp-sub')?.value,
          price: block.querySelector('.er-inp-price')?.value,
          image: block.querySelector('.er-inp-img')?.value,
          btnLabel: block.querySelector('.er-inp-btn')?.value,
          desc: block.querySelector('.er-inp-desc')?.value,
        })
      );
    });
    products = next;
  }

  function renderForm() {
    const sectionRows = sections
      .map(
        (sec, sidx) => `
      <div class="er-sec flex flex-wrap gap-3 items-end border border-zinc-700 p-3 rounded-lg mb-2" data-sec-idx="${sidx}">
        <div class="w-full sm:w-32">
          <label class="block text-sm text-gray-400 mb-1">ID (interno)</label>
          <input type="text" readonly class="er-sec-id w-full p-2 bg-zinc-950 border border-zinc-600 rounded text-gray-400 text-sm" value="${escapeAttr(sec.id)}">
        </div>
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm text-gray-400 mb-1">Nombre de la sección</label>
          <input type="text" class="er-sec-name w-full p-3 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(sec.name)}">
        </div>
        <div class="w-24">
          <label class="block text-sm text-gray-400 mb-1">Orden</label>
          <input type="number" class="er-sec-order w-full p-3 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${sec.order}">
        </div>
        <button type="button" class="er-sec-remove text-red-400 text-sm py-2 px-2 shrink-0">Quitar sección</button>
      </div>
    `
      )
      .join('');

    const rows = products
      .map(
        (prod, idx) => `
      <div class="er-prod border-2 border-zinc-600 rounded-lg p-5 space-y-4 bg-zinc-900/80 mb-4" data-idx="${idx}">
        <div class="flex flex-wrap justify-between items-center gap-2">
          <span class="text-xl font-bold text-white">Producto ${idx + 1}</span>
          <button type="button" class="er-prod-remove text-lg text-red-400 hover:underline py-2">Quitar</button>
        </div>
        <div>
          <label class="block text-lg font-semibold text-gray-200 mb-1">Sección</label>
          <select class="er-inp-section w-full text-xl p-3 bg-black border-2 border-zinc-600 rounded-lg text-white" aria-label="Sección">
            ${sectionSelectOptionsMarkup(prod, sections)}
          </select>
        </div>
        <div>
          <label class="block text-lg font-semibold text-gray-200 mb-1">Nombre</label>
          <input type="text" class="er-inp-title w-full text-xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(prod.title)}">
        </div>
        <div>
          <label class="block text-lg font-semibold text-gray-200 mb-1">Línea chica (debajo del nombre)</label>
          <input type="text" class="er-inp-sub w-full text-xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(prod.subtitle)}">
        </div>
        <div>
          <label class="block text-lg font-semibold text-gray-200 mb-1">Precio</label>
          <input type="text" class="er-inp-price w-full text-xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(prod.price)}" placeholder="Ej: $15.000 ARS">
        </div>
        <div>
          <label class="block text-lg font-semibold text-gray-200 mb-1">Foto (archivo o enlace)</label>
          <div class="flex gap-2">
            <input type="text" class="er-inp-img w-full text-xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(prod.image)}" placeholder="foto1.jpeg">
            <button type="button" class="er-btn-upload bg-zinc-700 hover:bg-zinc-600 text-white px-4 rounded-lg text-sm shrink-0 flex items-center gap-2"><i class="fas fa-cloud-upload-alt"></i> Subir</button>
          </div>
          <p class="text-xs text-gray-500 mt-1">Podés poner el nombre del archivo (si está en GitHub) o un enlace de internet (Supabase, Cloudinary, etc.)</p>
        </div>
        <div>
          <label class="block text-lg font-semibold text-gray-200 mb-1">Texto del botón</label>
          <input type="text" class="er-inp-btn w-full text-xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(prod.btnLabel)}">
        </div>
        <div>
          <label class="block text-lg font-semibold text-gray-200 mb-1">Descripción (detalle)</label>
          <textarea rows="4" class="er-inp-desc w-full text-lg p-4 bg-black border-2 border-zinc-600 rounded-lg text-white"></textarea>
        </div>
      </div>
    `
      )
      .join('');

    overlay.innerHTML = `
      <div class="max-w-3xl w-full my-8 bg-zinc-900 border-2 border-zinc-500 rounded-xl p-6 md:p-8 relative shadow-2xl">
        <button type="button" id="er-tienda-close-x" class="er-modal-close-x">&times;</button>
        <h2 class="text-3xl font-serif font-bold text-white mb-2">Gestionar la tienda</h2>
        <div class="bg-amber-900/20 border border-amber-700/50 p-4 rounded-lg mb-6">
          <p class="text-amber-200 text-sm leading-relaxed italic">
            <strong>Configuración de Supabase:</strong><br>
            Para subir fotos sin usar GitHub, necesitás la URL y Anon Key de tu proyecto. Las fotos se guardarán en el bucket que elijas (ej: 'images'). <strong>Importante: el bucket debe estar configurado como PUBLIC en Supabase.</strong>
          </p>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            <button type="button" id="er-setup-supabase-tienda" class="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded">Configurar Supabase</button>
            <span id="er-supabase-status-tienda" class="text-[10px] text-amber-300 flex items-center"></span>
          </div>
        </div>
        <div class="bg-amber-900/20 border border-amber-700/50 p-4 rounded-lg mb-6">
          <p class="text-amber-200 text-sm leading-relaxed italic">
            <strong>Instrucciones:</strong><br>
            1. Editá los productos, precios y fotos.<br>
            2. Tocá <strong>Guardar Cambios en la Nube</strong> para sincronizar todo.<br>
            3. (Opcional) Descargá el archivo si querés tener un respaldo en GitHub.
          </p>
        </div>
        <div class="space-y-4 mb-6">
          <div>
            <label class="block text-lg font-semibold text-gray-200 mb-1">Título de la página</label>
            <input type="text" id="er-tienda-titulo" class="w-full text-2xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(titulo)}">
          </div>
          <div>
            <label class="block text-lg font-semibold text-gray-200 mb-1">Texto debajo del título</label>
            <textarea id="er-tienda-sub" rows="3" class="w-full text-xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white"></textarea>
          </div>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">Secciones</h3>
        <div id="er-tienda-sections" class="mb-4">${sectionRows}</div>
        <button type="button" id="er-tienda-add-sec" class="w-full py-3 text-lg font-bold rounded-lg border-2 border-dashed border-zinc-500 text-gray-200 hover:border-brand-red mb-8">+ Agregar sección</button>
        <h3 class="text-xl font-bold text-white mb-2">Productos</h3>
        <div id="er-tienda-prod-list" class="mb-6">${rows}</div>
        <button type="button" id="er-tienda-add" class="w-full py-4 text-xl font-bold rounded-lg border-2 border-dashed border-zinc-500 text-gray-200 hover:border-brand-red hover:text-white mb-8">+ Agregar producto</button>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button type="button" id="er-tienda-save" class="w-full py-6 text-xl font-bold rounded-lg bg-green-700 hover:bg-green-600 text-white">Sincronizar en la Nube</button>
          <button type="button" id="er-tienda-export" class="w-full py-6 text-xl font-bold rounded-lg bg-blue-700 hover:bg-blue-600 text-white">Descargar Respaldo (JSON)</button>
        </div>
        
        <button type="button" id="er-tienda-reset-store" class="w-full py-3 text-lg rounded-lg border border-amber-600 text-amber-200 mt-8 mb-4">Volver a datos originales</button>
        <button type="button" id="er-tienda-close" class="w-full py-4 text-xl rounded-lg border-2 border-zinc-500 text-gray-200">Cerrar sin guardar</button>
      </div>
    `;

    const subTa = overlay.querySelector('#er-tienda-sub');
    if (subTa) subTa.value = subtitulo;
    overlay.querySelectorAll('.er-prod').forEach((block, i) => {
      const ta = block.querySelector('.er-inp-desc');
      if (ta) ta.value = products[i]?.desc ?? '';
    });

    const updateSupabaseStatus = (btnId, statusId) => {
      const sUrl = localStorage.getItem('er_supabase_url');
      const sStatus = overlay.querySelector(`#${statusId}`);
      if (sUrl && sStatus) {
        sStatus.innerHTML = `<i class="fas fa-check-circle text-green-400 mr-1"></i> Conectado: ${new URL(sUrl).hostname}`;
      } else if (sStatus) {
        sStatus.innerHTML = '<i class="fas fa-exclamation-circle text-amber-400 mr-1"></i> No configurado';
      }
    };

    updateSupabaseStatus('er-setup-supabase-tienda', 'er-supabase-status-tienda');

    overlay.querySelector('#er-setup-supabase-tienda')?.addEventListener('click', () => {
      const url = window.prompt('URL de Supabase (ej: https://xyz.supabase.co):', localStorage.getItem('er_supabase_url') || '');
      const key = window.prompt('Anon Key de Supabase:', localStorage.getItem('er_supabase_key') || '');
      const bucket = window.prompt('Nombre del Bucket (ej: images):', localStorage.getItem('er_supabase_bucket') || 'images');
      if (url && key) {
        localStorage.setItem('er_supabase_url', url);
        localStorage.setItem('er_supabase_key', key);
        localStorage.setItem('er_supabase_bucket', bucket || 'images');
        updateSupabaseStatus('er-setup-supabase-tienda', 'er-supabase-status-tienda');
      }
    });

    overlay.querySelectorAll('.er-btn-upload').forEach(btn => {
      btn.addEventListener('click', async () => {
        const input = btn.parentElement?.querySelector('input');
        if (!input) return;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = async () => {
          const file = fileInput.files?.[0];
          if (!file) return;

          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
          btn.disabled = true;

          try {
            const publicUrl = await uploadToSupabase(file);
            input.value = publicUrl;
            window.alert('¡Foto subida con éxito a Supabase! La URL se ha copiado al campo.');
          } catch (err) {
            window.alert('Error al subir: ' + err.message);
          } finally {
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir';
            btn.disabled = false;
          }
        };
        fileInput.click();
      });
    });

    overlay.querySelector('#er-tienda-export')?.addEventListener('click', () => {
      if (window.exportStoreToJson) window.exportStoreToJson();
    });

    overlay.querySelector('#er-tienda-save')?.addEventListener('click', async () => {
      snapshotFromInputs();
      if (sections.length === 0) {
        window.alert('Tiene que haber al menos una sección.');
        return;
      }
      products = products.filter(x => String(x.title || '').trim());
      if (products.length === 0) {
        window.alert('Tiene que haber al menos un producto con nombre.');
        return;
      }
      const state = window.normalizeStoreState({
        titulo,
        subtitulo,
        sections,
        products,
      });

      const btn = overlay.querySelector('#er-tienda-save');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
      btn.disabled = true;

      try {
        await window.persistStoreState(state);
        if (window.saveJsonToSupabase) {
          await window.saveJsonToSupabase('store.json', state);
        }
        persistTiendaHeader(titulo, subtitulo);
        syncTiendaFromState();
        renderDynamicNavMenu(); // Actualizar menú nav
        window.alert('¡Tienda sincronizada en la nube con éxito! Los cambios ya son visibles para todos.');
        close();
      } catch (ex) {
        window.alert('Error al sincronizar: ' + (ex?.message || String(ex)));
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    overlay.querySelector('#er-tienda-add')?.addEventListener('click', () => {
      snapshotFromInputs();
      products.push(
        normProd({
          id: crypto?.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`,
          sectionId: sections[0]?.id || 'obras',
          title: 'Nuevo producto',
          subtitle: '',
          price: '',
          image: 'foto1.jpeg',
          desc: '',
          btnLabel: 'VER DETALLE',
        })
      );
      renderForm();
    });

    overlay.querySelector('#er-tienda-add-sec')?.addEventListener('click', () => {
      snapshotFromInputs();
      const id = `sec-${Date.now()}`;
      sections.push(normSec({ id, name: 'Nueva sección', order: sections.length }));
      renderForm();
    });

    overlay.addEventListener('input', () => {
      snapshotFromInputs();
      const state = window.normalizeStoreState({
        titulo,
        subtitulo,
        sections,
        products,
      });
      window.persistStoreState?.(state);
    });

    overlay.querySelector('#er-tienda-reset-store')?.addEventListener('click', () => {
      snapshotFromInputs();
      const id = `sec-${Date.now()}`;
      sections.push(normSec({ id, name: 'Nueva sección', order: sections.length }));
      renderForm();
    });

    overlay.querySelectorAll('.er-prod-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        snapshotFromInputs();
        const block = btn.closest('.er-prod');
        const idx = Number(block?.dataset.idx);
        if (Number.isNaN(idx)) return;
        products.splice(idx, 1);
        renderForm();
      });
    });

    overlay.querySelectorAll('.er-sec-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        snapshotFromInputs();
        const block = btn.closest('.er-sec');
        const idx = Number(block?.dataset.secIdx);
        if (Number.isNaN(idx) || sections.length <= 1) {
          window.alert('Tiene que quedar al menos una sección.');
          return;
        }
        const removed = sections[idx]?.id;
        const fallback = sections.filter((_, i) => i !== idx)[0]?.id;
        sections.splice(idx, 1);
        products.forEach(pr => {
          if (pr.sectionId === removed) pr.sectionId = fallback;
        });
        renderForm();
      });
    });

    overlay.querySelector('#er-tienda-reset-store')?.addEventListener('click', async () => {
      const ok = window.confirm('¿Volver a los datos de ejemplo? Se reemplaza el catálogo actual.');
      if (!ok) return;
      const def = window.getDefaultStoreState?.() || window.normalizeStoreState({});
      try {
        await window.persistStoreState(def);
        titulo = def.titulo;
        subtitulo = def.subtitulo;
        sections = (def.sections || []).map(s => ({ ...s }));
        products = (def.products || []).map(p => ({ ...p }));
        persistTiendaHeader(titulo, subtitulo);
        syncTiendaFromState();
        renderForm();
      } catch (ex) {
        window.alert(ex?.message || String(ex));
      }
    });

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
    };

    const onEsc = e => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onEsc);

    overlay.querySelector('#er-tienda-close-x')?.addEventListener('click', close);
    overlay.querySelector('#er-tienda-close')?.addEventListener('click', close);
  }

  renderForm();
}

function isOwnerEditSession() {
  return sessionStorage.getItem(ER_OWNER_SESSION_KEY) === '1';
}

function syncTiendaProductMeta(key, textValue, imgUrl) {
  const nMatch = String(key).match(/tienda_(nombre|img|btn|tipo)_(\d)/);
  if (!nMatch) return;
  const kind = nMatch[1];
  const n = nMatch[2];
  const imgEl = document.querySelector(`[data-edit-image="tienda_img_${n}"]`);
  const card = imgEl?.closest('.bg-black.border');
  const btn = card?.querySelector('.product-detail-btn');
  if (!btn) return;
  if (kind === 'nombre' && textValue !== undefined) {
    btn.setAttribute('data-title', textValue.trim());
  }
  if (kind === 'img' && imgUrl) {
    btn.setAttribute('data-img', imgUrl.trim());
  }
}

function applyTextToEditableEl(el, key, raw) {
  const v = String(raw ?? '').trim();
  if (key === 'artista_cta' && el.tagName === 'A') {
    el.innerHTML = `${escapeHtml(v)} <i class="fas fa-arrow-right"></i>`;
    return;
  }
  el.textContent = v;
}

function initializeEditableContent() {
  ensureOwnerEditSessionFromUrl();

  const editableItems = Array.from(document.querySelectorAll('[data-edit-key]'));
  const editableImages = Array.from(document.querySelectorAll('[data-edit-image]'));
  const editableGalleries = Array.from(document.querySelectorAll('[data-edit-gallery]'));
  if (editableItems.length === 0 && editableImages.length === 0 && editableGalleries.length === 0) return;

  const pageId = location.pathname.split('/').pop() || 'index.html';
  const pageKey = `er_editable_${pageId}`;
  let saved = safeJsonParse(localStorage.getItem(pageKey), {});
  const st = window.getStoreState?.();
  const useTiendaStore = Boolean(document.getElementById('store-grid') && st);

  // Intentar cargar contenido desde un archivo estático data/pages.json si existe
  async function loadStaticPagesJson() {
    let remotePages = {};

    // 1. Intentar cargar desde Supabase (PRIORITARIO)
    if (window.loadJsonFromSupabase) {
      try {
        const cloud = await window.loadJsonFromSupabase('pages.json');
        if (cloud) {
          window.__remotePages = cloud;
          const cloudData = cloud[pageId];
          if (cloudData) {
            // Siempre actualizamos localStorage con lo de la nube para asegurar sincronización
            // Solo si NO estamos en una sesión de edición activa con cambios locales pendientes
            const inSession = isOwnerEditSession();
            if (!inSession || !localStorage.getItem(pageKey)) {
              saved = cloudData;
              localStorage.setItem(pageKey, JSON.stringify(saved));
              applySavedContent();
            } else {
              // Si estamos en sesión, usamos lo local pero guardamos lo remoto como referencia
              saved = safeJsonParse(localStorage.getItem(pageKey), cloudData);
              applySavedContent();
            }
          }
          return; 
        }
      } catch (e) {
        console.error('Error cargando de Supabase:', e);
      }
    }

    // 2. Fallback a GitHub data/pages.json (solo si no cargó de la nube)
    try {
      const r = await fetch('./data/pages.json', { cache: 'no-cache' });
      if (r.ok) {
        remotePages = await r.json();
        if (remotePages[pageId]) {
          // Solo aplicamos si no hay nada en localStorage todavía (primera carga)
          if (!localStorage.getItem(pageKey)) {
            saved = remotePages[pageId];
            localStorage.setItem(pageKey, JSON.stringify(saved));
            applySavedContent();
          }
        }
      }
    } catch (_) {}
    
    window.__remotePages = remotePages;
  }

  function applySavedContent() {
    editableItems.forEach((el) => {
      const key = el.getAttribute('data-edit-key');
      if (!key) return;
      if (useTiendaStore && st && key === 'tienda_titulo' && typeof st.titulo === 'string') {
        applyTextToEditableEl(el, key, st.titulo);
        return;
      }
      if (useTiendaStore && st && key === 'tienda_subtitulo') {
        applyTextToEditableEl(el, key, st.subtitulo ?? '');
        return;
      }
      if (typeof saved[key] === 'string') {
        applyTextToEditableEl(el, key, saved[key]);
      }
    });

    editableImages.forEach((img) => {
      const key = img.getAttribute('data-edit-image');
      if (!key) return;
      if (typeof saved[key] === 'string' && saved[key].trim()) {
        img.src = saved[key].trim();
      }
    });

    editableGalleries.forEach((gal) => {
      const key = gal.getAttribute('data-edit-gallery');
      if (!key) return;
      const list = Array.isArray(saved[key]) ? saved[key] : [];
      gal.innerHTML = list.map(imgSrc => `
        <div class="aspect-square bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden group">
          <img src="${escapeAttr(imgSrc)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
        </div>
      `).join('');
    });
  }

  applySavedContent();
  loadStaticPagesJson();

  if (!isOwnerEditSession() && !window.isStoreOwnerLoggedIn?.()) return;

  // Habilitar edición directa en la página
  editableItems.forEach(el => {
    el.setAttribute('contenteditable', 'true');
    el.classList.add('admin-editable-active');
    
    // Auto-guardado local al escribir para no perder nada con F5
    el.addEventListener('input', () => {
      const key = el.getAttribute('data-edit-key');
      if (key) {
        saved[key] = el.textContent || '';
        localStorage.setItem(pageKey, JSON.stringify(saved));
      }
    });
  });

  if (document.getElementById('store-grid')) {
    const panel = document.createElement('div');
    panel.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 flex flex-col gap-3';
    panel.innerHTML = `
      <button type="button" id="er-tienda-save-direct" class="w-full py-6 px-5 text-2xl font-bold rounded-lg bg-green-700 hover:bg-green-600 text-white shadow-lg border-2 border-green-500/50 flex items-center justify-center gap-3">
        <i class="fas fa-cloud-upload-alt"></i> GUARDAR TODO
      </button>
      <button type="button" id="er-tienda-gestionar" class="w-full py-4 px-5 text-xl font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white shadow-lg border border-zinc-600">
        Panel de Control
      </button>
      <button type="button" id="er-owner-exit-tienda" class="w-full py-3 px-4 text-lg rounded-lg bg-black/80 border border-zinc-700 hover:border-white text-gray-400">
        Salir del Editor
      </button>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#er-tienda-save-direct')?.addEventListener('click', async () => {
      const btn = panel.querySelector('#er-tienda-save-direct');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO...';
      btn.disabled = true;

      try {
        const base = window.getStoreState?.() || {};
        const state = {
          ...base,
          titulo: document.querySelector('[data-edit-key="tienda_titulo"]')?.textContent || base.titulo,
          subtitulo: document.querySelector('[data-edit-key="tienda_subtitulo"]')?.textContent || base.subtitulo,
        };
        
        await window.persistStoreState(state);
        if (window.saveJsonToSupabase) {
          await window.saveJsonToSupabase('store.json', state);
        }
        renderDynamicNavMenu(); // Refrescar menú nav
        window.alert('¡Todo guardado en la nube con éxito! Ya es público para todos.');
      } catch (e) {
        window.alert('Error al guardar: ' + e.message);
      } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    });

    panel.querySelector('#er-tienda-gestionar')?.addEventListener('click', () => openTiendaStoreAdmin());
    panel.querySelector('#er-owner-exit-tienda')?.addEventListener('click', () => {
      sessionStorage.removeItem(ER_OWNER_SESSION_KEY);
      window.location.reload();
    });
    return;
  }

  const persistFromDom = async () => {
    const next = {};
    editableItems.forEach((el) => {
      const key = el.getAttribute('data-edit-key');
      if (!key) return;
      if (key === 'artista_cta') {
        next[key] = (el.textContent || '').replace(/\s+/g, ' ').trim();
      } else {
        next[key] = el.textContent || '';
      }
    });
    editableImages.forEach((img) => {
      const key = img.getAttribute('data-edit-image');
      if (!key) return;
      next[key] = img.getAttribute('src') || '';
    });
    editableGalleries.forEach((gal) => {
      const key = gal.getAttribute('data-edit-gallery');
      if (!key) return;
      if (saved[key]) next[key] = saved[key];
    });
    localStorage.setItem(pageKey, JSON.stringify(next));
    
    // Sincronizar con Supabase automáticamente al persistir desde el DOM
    if (typeof window.saveJsonToSupabase === 'function') {
      const currentPageId = location.pathname.split('/').pop() || 'index.html';
      const allPages = window.__remotePages || {};
      allPages[currentPageId] = next;
      
      try {
        await window.saveJsonToSupabase('pages.json', allPages);
      } catch (err) {
        console.error('Supabase auto-sync failed:', err);
        throw new Error('No se pudo sincronizar con la nube (Supabase). Verificá tu conexión o configuración.');
      }
    }
  };

  const panel = document.createElement('div');
  panel.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 flex flex-col gap-3';
  panel.innerHTML = `
    <button type="button" id="er-owner-save-global" class="w-full py-6 px-6 text-2xl font-bold rounded-sm bg-green-700 hover:bg-green-600 text-white shadow-lg border-2 border-green-500/50 flex items-center justify-center gap-3">
      <i class="fas fa-save"></i> GUARDAR CAMBIOS
    </button>
    <button type="button" id="er-owner-open-editor" class="w-full py-4 px-6 text-xl font-bold rounded-sm bg-brand-red hover:bg-brand-dark-red text-white shadow-lg border border-brand-red/40">
      Panel de Fotos y Reseñas
    </button>
    <div class="grid grid-cols-2 gap-2">
      <button type="button" id="er-owner-hide-panel" class="py-3 px-4 text-sm rounded-sm bg-zinc-800 border border-zinc-700 hover:border-white text-gray-400">
        Ocultar Panel
      </button>
      <button type="button" id="er-owner-exit-btn" class="py-3 px-4 text-sm rounded-sm bg-black/80 border border-zinc-700 hover:border-white text-gray-400">
        Salir
      </button>
    </div>
  `;
  document.body.appendChild(panel);

  panel.querySelector('#er-owner-hide-panel')?.addEventListener('click', () => {
    panel.style.display = 'none';
    // Agregar un pequeño botón flotante para volver a mostrarlo
    const showBtn = document.createElement('button');
    showBtn.innerHTML = '<i class="fas fa-edit"></i>';
    showBtn.className = 'fixed bottom-4 left-4 w-12 h-12 bg-brand-red text-white rounded-full shadow-2xl z-50 flex items-center justify-center';
    showBtn.onclick = () => {
      panel.style.display = 'flex';
      showBtn.remove();
    };
    document.body.appendChild(showBtn);
  });

  panel.querySelector('#er-owner-save-global')?.addEventListener('click', async () => {
    const btn = panel.querySelector('#er-owner-save-global');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GUARDANDO...';
    btn.disabled = true;

    try {
      await persistFromDom();
      window.alert('¡Cambios sincronizados en la nube correctamente!');
    } catch (e) {
      window.alert('Error al sincronizar: ' + e.message);
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  });

  const openBtn = panel.querySelector('#er-owner-open-editor');
  const exitBtn = panel.querySelector('#er-owner-exit-btn');

  openBtn?.addEventListener('click', openOwnerEditorModal);
  exitBtn?.addEventListener('click', () => {
    sessionStorage.removeItem(ER_OWNER_SESSION_KEY);
    window.location.reload();
  });

function openOwnerEditorModal() {
    const overlay = document.createElement('div');
    overlay.id = 'er-owner-editor-overlay';
    overlay.className = 'fixed inset-0 z-[200] bg-black/92 overflow-y-auto p-4 flex items-start justify-center';
    
    const close = () => {
      document.removeEventListener('keydown', onEsc);
      overlay.remove();
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onEsc);

    overlay.innerHTML = `
      <div class="w-full max-w-2xl my-6 bg-zinc-900 border-2 border-zinc-600 rounded-lg p-6 md:p-8 shadow-2xl relative animate-modal-in">
        <button type="button" id="er-owner-close-x" class="er-modal-close-x">&times;</button>
        <div class="bg-blue-900/20 border border-blue-700/50 p-4 rounded-lg mb-6">
          <p class="text-blue-200 text-sm leading-relaxed italic">
            <strong>Instrucciones:</strong><br>
            1. Editá los textos y fotos de esta página.<br>
            2. Tocá <strong>Sincronizar en la Nube</strong> para publicar los cambios.<br>
          </p>
          <div class="mt-3 flex flex-wrap gap-2 items-center">
            <button type="button" id="er-setup-supabase" class="text-[10px] bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded">Configurar Supabase</button>
            <span id="er-supabase-status" class="text-[9px] text-blue-300"></span>
          </div>
        </div>
        <div class="flex border-b border-zinc-800 mb-6">
          <button id="er-tab-content" class="px-6 py-3 text-lg font-bold border-b-2 border-brand-red text-white">Contenido</button>
          <button id="er-tab-reviews" class="px-6 py-3 text-lg font-bold text-gray-500 hover:text-white transition">Reseñas</button>
        </div>
        
        <div id="er-editor-content-pane">
          <h2 class="text-2xl md:text-3xl font-serif font-bold text-white mb-2">Cambiar textos</h2>
          <div id="er-owner-fields" class="space-y-6 mb-8"></div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <button type="button" id="er-owner-save" class="w-full py-5 text-xl font-bold rounded-sm bg-green-700 hover:bg-green-600 text-white">Sincronizar en la Nube</button>
            <button type="button" id="er-owner-export" class="w-full py-5 text-xl font-bold rounded-sm bg-blue-700 hover:bg-blue-600 text-white">Descargar Respaldo</button>
          </div>
        </div>

        <div id="er-editor-reviews-pane" class="hidden">
          <h2 class="text-2xl md:text-3xl font-serif font-bold text-white mb-2">Administrar Reseñas</h2>
          <p class="text-gray-400 mb-6">Acá podés borrar las reseñas que dejaron los visitantes.</p>
          <div id="er-reviews-admin-list" class="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2">
            <!-- Cargado vía JS -->
          </div>
        </div>

        <div class="mt-6 pt-6 border-t border-zinc-800">
          <button type="button" id="er-owner-factory" class="w-full py-3 text-lg rounded-sm border border-amber-600/80 text-amber-200 hover:bg-amber-950/50 mb-3">Volver a los textos originales</button>
          <button type="button" id="er-owner-close" class="w-full py-4 text-lg rounded-sm border border-zinc-500 text-gray-200 hover:bg-zinc-800">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const contentPane = overlay.querySelector('#er-editor-content-pane');
    const reviewsPane = overlay.querySelector('#er-editor-reviews-pane');
    const tabContent = overlay.querySelector('#er-tab-content');
    const tabReviews = overlay.querySelector('#er-tab-reviews');

    tabContent.addEventListener('click', () => {
      contentPane.classList.remove('hidden');
      reviewsPane.classList.add('hidden');
      tabContent.classList.add('border-b-2', 'border-brand-red', 'text-white');
      tabContent.classList.remove('text-gray-500');
      tabReviews.classList.remove('border-b-2', 'border-brand-red', 'text-white');
      tabReviews.classList.add('text-gray-500');
    });

    tabReviews.addEventListener('click', () => {
      contentPane.classList.add('hidden');
      reviewsPane.classList.remove('hidden');
      tabReviews.classList.add('border-b-2', 'border-brand-red', 'text-white');
      tabReviews.classList.remove('text-gray-500');
      tabContent.classList.remove('border-b-2', 'border-brand-red', 'text-white');
      tabContent.classList.add('text-gray-500');
      renderAdminReviews();
    });

    const updateSupabaseStatus = (btnId, statusId) => {
      const sUrl = localStorage.getItem('er_supabase_url');
      const sStatus = overlay.querySelector(`#${statusId}`);
      if (sUrl && sStatus) {
        sStatus.innerHTML = `<i class="fas fa-check-circle text-green-400 mr-1"></i> Conectado: ${new URL(sUrl).hostname}`;
      } else if (sStatus) {
        sStatus.innerHTML = '<i class="fas fa-exclamation-circle text-amber-400 mr-1"></i> No configurado';
      }
    };

    updateSupabaseStatus('er-setup-supabase', 'er-supabase-status');

    overlay.querySelector('#er-setup-supabase')?.addEventListener('click', () => {
      const url = window.prompt('URL de Supabase (ej: https://xyz.supabase.co):', localStorage.getItem('er_supabase_url') || '');
      const key = window.prompt('Anon Key de Supabase:', localStorage.getItem('er_supabase_key') || '');
      const bucket = window.prompt('Nombre del Bucket (ej: images):', localStorage.getItem('er_supabase_bucket') || 'images');
      if (url && key) {
        localStorage.setItem('er_supabase_url', url);
        localStorage.setItem('er_supabase_key', key);
        localStorage.setItem('er_supabase_bucket', bucket || 'images');
        updateSupabaseStatus('er-setup-supabase', 'er-supabase-status');
      }
    });

    function renderAdminReviews() {
      const list = overlay.querySelector('#er-reviews-admin-list');
      if (!list) return;
      const reviews = getStoredList(STORAGE_KEYS.reviews);
      if (reviews.length === 0) {
        list.innerHTML = '<p class="text-gray-500 italic">No hay reseñas para mostrar.</p>';
        return;
      }
      list.innerHTML = reviews.map(r => `
        <div class="bg-black/40 p-4 border border-zinc-800 rounded flex justify-between items-start gap-4">
          <div class="flex-1">
            <div class="flex text-brand-red text-xs mb-1">${Array(r.rating).fill('<i class="fas fa-star"></i>').join('')}</div>
            <div class="text-white font-bold text-sm">${escapeHtml(r.name)}</div>
            <div class="text-gray-400 text-xs italic mt-1">"${escapeHtml(r.comment)}"</div>
          </div>
          <button data-delete-id="${r.id}" class="text-red-500 hover:text-red-400 p-2"><i class="fas fa-trash"></i></button>
        </div>
      `).join('');

      list.querySelectorAll('[data-delete-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.deleteId;
          if (confirm('¿Seguro que querés borrar esta reseña?')) {
            const current = getStoredList(STORAGE_KEYS.reviews);
            const filtered = current.filter(r => r.id !== id);
            setStoredList(STORAGE_KEYS.reviews, filtered);
            renderAdminReviews();
            renderStoredReviews();
          }
        });
      });
    }

    const fieldsRoot = overlay.querySelector('#er-owner-fields');

    editableItems.forEach((el) => {
      const key = el.getAttribute('data-edit-key');
      if (!key) return;
      const label = el.getAttribute('data-edit-label') || key;
      let val = el.textContent || '';
      if (key === 'artista_cta') {
        val = val.replace(/\s*$/,'').trim();
      }
      const wrap = document.createElement('div');
      wrap.className = 'space-y-2';
      const lab = document.createElement('label');
      lab.className = 'block text-lg font-semibold text-gray-100';
      lab.setAttribute('for', `er-field-${key}`);
      lab.textContent = label;
      const ta = document.createElement('textarea');
      ta.id = `er-field-${key}`;
      ta.dataset.editKey = key;
      ta.rows = key.includes('parrafo') || key.includes('subtitulo') ? 5 : 2;
      ta.className = 'w-full text-lg md:text-xl p-4 bg-black border-2 border-zinc-600 rounded-sm text-white placeholder-gray-600 min-h-[3rem]';
      ta.value = val;
      
      ta.addEventListener('input', () => {
        saved[key] = ta.value;
        localStorage.setItem(pageKey, JSON.stringify(saved));
        // Actualizar el elemento en la página también en tiempo real
        const el = document.querySelector(`[data-edit-key="${key}"]`);
        if (el) el.textContent = ta.value;
      });

      wrap.appendChild(lab);
      wrap.appendChild(ta);
      fieldsRoot?.appendChild(wrap);
    });

    editableImages.forEach((img) => {
      const key = img.getAttribute('data-edit-image');
      if (!key) return;
      const label = img.getAttribute('data-edit-label') || 'Foto';
      const wrap = document.createElement('div');
      wrap.className = 'space-y-2';
      const lab = document.createElement('label');
      lab.className = 'block text-lg font-semibold text-gray-100';
      lab.setAttribute('for', `er-field-${key}`);
      lab.textContent = label;
      const wrapInp = document.createElement('div');
      wrapInp.className = 'flex gap-2';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = `er-field-${key}`;
      inp.dataset.editImage = key;
      inp.className = 'flex-1 text-lg md:text-xl p-4 bg-black border-2 border-zinc-600 rounded-sm text-white';
      inp.value = img.getAttribute('src') || '';
      
      const updateImg = (val) => {
        saved[key] = val;
        localStorage.setItem(pageKey, JSON.stringify(saved));
        img.src = val;
      };

      inp.addEventListener('input', () => updateImg(inp.value));

      const uBtn = document.createElement('button');
      uBtn.type = 'button';
      uBtn.className = 'bg-zinc-700 hover:bg-zinc-600 text-white px-4 rounded-sm text-sm shrink-0';
      uBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
      uBtn.onclick = async () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = async () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          uBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          try {
            const publicUrl = await uploadToSupabase(file);
            inp.value = publicUrl;
            updateImg(publicUrl);
          } catch (e) { alert(e.message); }
          finally { uBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>'; }
        };
        fileInput.click();
      };
      wrapInp.appendChild(inp);
      wrapInp.appendChild(uBtn);
      wrap.appendChild(lab);
      wrap.appendChild(wrapInp);
      fieldsRoot?.appendChild(wrap);
    });

    editableGalleries.forEach((gal) => {
      const key = gal.getAttribute('data-edit-gallery');
      if (!key) return;
      const label = gal.getAttribute('data-edit-label') || 'Galería de fotos';
      const list = Array.isArray(saved[key]) ? [...saved[key]] : [];

      const wrap = document.createElement('div');
      wrap.className = 'space-y-4 pt-6 border-t border-zinc-800';
      wrap.innerHTML = `
        <label class="block text-xl font-bold text-brand-red">${label}</label>
        <div id="er-gal-list-${key}" class="space-y-3">
          ${list.map((src, i) => `
            <div class="flex gap-2 items-center er-gal-item" data-idx="${i}">
              <img src="${escapeAttr(src)}" class="w-12 h-12 object-cover rounded border border-zinc-700">
              <input type="text" class="flex-1 p-3 bg-black border-2 border-zinc-600 rounded text-white text-sm" value="${escapeAttr(src)}">
              <button type="button" class="er-btn-upload-gal bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-xs shrink-0"><i class="fas fa-cloud-upload-alt"></i></button>
              <button type="button" class="er-gal-remove text-red-500 p-2"><i class="fas fa-trash"></i></button>
            </div>
          `).join('')}
        </div>
        <button type="button" id="er-gal-add-${key}" class="w-full py-3 border-2 border-dashed border-zinc-600 rounded text-gray-400 hover:text-white hover:border-white transition">+ Agregar otra foto</button>
      `;
      fieldsRoot?.appendChild(wrap);

      const listContainer = wrap.querySelector(`#er-gal-list-${key}`);
      const addBtn = wrap.querySelector(`#er-gal-add-${key}`);

      let updateListEvents = () => {
        listContainer.querySelectorAll('.er-gal-remove').forEach(btn => {
          btn.onclick = () => {
            btn.closest('.er-gal-item').remove();
          };
        });
      };

      const updateUploadEvents = () => {
        listContainer.querySelectorAll('.er-btn-upload-gal').forEach(uBtn => {
          if (uBtn.dataset.bound) return;
          uBtn.dataset.bound = '1';
          uBtn.onclick = async () => {
            const input = uBtn.parentElement?.querySelector('input');
            if (!input) return;
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = async () => {
              const file = fileInput.files?.[0];
              if (!file) return;
              uBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
              try {
                const publicUrl = await uploadToSupabase(file);
                input.value = publicUrl;
                const imgPreview = uBtn.parentElement?.querySelector('img') || uBtn.parentElement?.querySelector('.w-12');
                if (imgPreview) {
                  if (imgPreview.tagName === 'IMG') imgPreview.src = publicUrl;
                  else imgPreview.innerHTML = `<img src="${publicUrl}" class="w-full h-full object-cover rounded">`;
                }
              } catch (e) { alert(e.message); }
              finally { uBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>'; }
            };
            fileInput.click();
          };
        });
      };
      
      const baseUpdateEvents = updateListEvents;
      updateListEvents = () => {
        baseUpdateEvents();
        updateUploadEvents();
      };

      updateListEvents();

      addBtn.onclick = () => {
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center er-gal-item';
        div.innerHTML = `
          <div class="w-12 h-12 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center text-gray-500"><i class="fas fa-image"></i></div>
          <input type="text" placeholder="img/fotoX.jpeg" class="flex-1 p-3 bg-black border-2 border-zinc-600 rounded text-white text-sm" value="">
          <button type="button" class="er-btn-upload-gal bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-xs shrink-0"><i class="fas fa-cloud-upload-alt"></i></button>
          <button type="button" class="er-gal-remove text-red-500 p-2"><i class="fas fa-trash"></i></button>
        `;
        listContainer.appendChild(div);
        updateListEvents();
      };
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('#er-owner-close-x')?.addEventListener('click', close);
    overlay.querySelector('#er-owner-close')?.addEventListener('click', close);

    overlay.querySelector('#er-owner-export')?.addEventListener('click', () => {
      const allPages = window.__remotePages || {};
      const currentPageId = location.pathname.split('/').pop() || 'index.html';
      const currentPageKey = `er_editable_${currentPageId}`;
      const currentPageData = safeJsonParse(localStorage.getItem(currentPageKey), {});
      
      // Actualizar el objeto global con los cambios de la página actual
      allPages[currentPageId] = currentPageData;
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allPages, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", "pages.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    });

    overlay.querySelector('#er-owner-factory')?.addEventListener('click', () => {
      const ok = window.confirm('¿Borrar todos los cambios guardados en esta página y volver al texto que ven los visitantes la primera vez?');
      if (!ok) return;
      localStorage.removeItem(pageKey);
      window.location.reload();
    });

    overlay.querySelector('#er-owner-save')?.addEventListener('click', async () => {
      // Aplicar cambios desde los inputs al DOM antes de persistir
      overlay.querySelectorAll('textarea[data-edit-key]').forEach((ta) => {
        const key = ta.dataset.editKey;
        const el = editableItems.find(x => x.getAttribute('data-edit-key') === key);
        if (!el || !key) return;
        applyTextToEditableEl(el, key, ta.value);
        syncTiendaProductMeta(key, ta.value, undefined);
      });
      overlay.querySelectorAll('input[data-edit-image]').forEach((inp) => {
        const key = inp.dataset.editImage;
        const img = editableImages.find(x => x.getAttribute('data-edit-image') === key);
        if (!img || !key) return;
        const url = String(inp.value || '').trim();
        if (url) {
          img.setAttribute('src', url);
          syncTiendaProductMeta(key, undefined, url);
        }
      });
      
      // Guardar galerías dinámicas
      editableGalleries.forEach((gal) => {
        const key = gal.getAttribute('data-edit-gallery');
        if (!key) return;
        const listContainer = overlay.querySelector(`#er-gal-list-${key}`);
        if (!listContainer) return;
        const items = Array.from(listContainer.querySelectorAll('.er-gal-item input')).map(inp => inp.value.trim()).filter(Boolean);
        saved[key] = items;
      });
      
      try {
        await persistFromDom();
        close();
        window.alert('¡Contenido sincronizado en la nube! Los cambios ya son visibles para todos.');
      } catch (err) {
        console.error('Error al guardar:', err);
        window.alert('Error: ' + err.message);
      }
    });
  }

  openBtn?.addEventListener('click', openOwnerEditorModal);
}

function initializeNavigation() {
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  const closeMobileMenu = () => {
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
      mobileMenu.classList.add('hidden');
      const icon = menuBtn?.querySelector('i');
      if (icon) {
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-xmark');
      }
    }
  };

  menuBtn?.addEventListener('click', () => {
    if (!mobileMenu) return;
    mobileMenu.classList.toggle('hidden');
    const icon = menuBtn.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-xmark');
    }
  });

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    
    if (href.includes('#')) {
      const parts = href.split('#');
      const pathPart = parts[0];
      const anchorPart = parts[1];
      
      const currentPath = window.location.pathname;
      const isSamePage = !pathPart || 
                         currentPath.endsWith(pathPart.replace('./', '')) ||
                         (currentPath === '/' && (pathPart === 'index.html' || pathPart === './index.html'));

      if (isSamePage && anchorPart) {
        const target = document.getElementById(anchorPart);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
          closeMobileMenu();
          return;
        }
      } else if (isSamePage && !anchorPart && href === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        closeMobileMenu();
        return;
      }
    }
    
    if (mobileMenu && mobileMenu.contains(anchor)) {
      setTimeout(closeMobileMenu, 150);
    }
  });
}

function initializeScrollAnimations() {
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    if (nav) {
      nav.classList.toggle('nav-scrolled', window.scrollY > 50);
    }
    
    // Cerrar dropdowns al hacer scroll para una experiencia más limpia
    document.querySelectorAll('.nav-dropdown').forEach(d => {
      d.style.opacity = '0';
      d.style.visibility = 'hidden';
      setTimeout(() => {
        d.style.opacity = '';
        d.style.visibility = '';
      }, 500);
    });
  });

  // Convertimos las secciones automáticas al sistema de reveal premium, excluyendo menús
  const containers = document.querySelectorAll('section, main > div, footer');
  containers.forEach(el => {
    if (!el.classList.contains('reveal') && !el.closest('nav')) {
      el.classList.add('reveal');
    }
  });
}

function initializeReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length === 0) return;
  
  // Opción para móviles: ser más flexible con el margen
  const isMobile = window.innerWidth < 768;
  const margin = isMobile ? '0px' : '0px 0px -50px 0px';

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        // Una vez visible, dejamos de observar para ahorrar recursos
        revealObserver.unobserve(entry.target);
      }
    });
  }, { 
    threshold: 0.05, // Bajamos el umbral para que se active antes
    rootMargin: margin
  });

  revealElements.forEach((el, index) => {
    // Si ya es visible por alguna razón, no hacer nada
    if (el.classList.contains('is-visible')) return;

    // Si el padre tiene la clase stagger-container, inyectamos el índice para el CSS
    if (el.parentElement && (el.parentElement.classList.contains('stagger-container') || el.parentElement.tagName === 'MAIN')) {
      el.style.setProperty('--stagger-idx', index % 15);
    }
    revealObserver.observe(el);
  });

  // Fallback: Si después de 2 segundos algo sigue invisible en el viewport inicial, lo forzamos
  setTimeout(() => {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        el.classList.add('is-visible');
      }
    });
  }, 1500);
}

document.addEventListener('DOMContentLoaded', () => {
  // Función auxiliar para inicializar con seguridad
  const safeInit = (name, fn) => {
    try {
      fn();
    } catch (e) {
      console.error(`Error inicializando ${name}:`, e);
    }
  };

  // Inicializaciones inmediatas (no bloqueantes)
  safeInit('Navigation', initializeNavigation);
  safeInit('Hero', initializeHeroBackground);
  safeInit('Fallbacks', initializeImageFallbacks);
  safeInit('Booking', initializeBooking);
  safeInit('Reviews', initializeReviews);
  safeInit('Store', initializeStore);
  safeInit('Login', initializePropietariosLogin);
  
  // Ejecutamos reveal lo antes posible para que la página no se vea negra
  safeInit('ScrollAnims', initializeScrollAnimations);
  safeInit('Reveal', initializeReveal);

  // Failsafe global: si después de 3 segundos la página sigue "negra", forzamos todo
  setTimeout(() => {
    const hiddenReveals = document.querySelectorAll('.reveal:not(.is-visible)');
    if (hiddenReveals.length > 0) {
      console.warn('Failsafe: Forzando visibilidad de elementos reveal.');
      hiddenReveals.forEach(el => el.classList.add('is-visible'));
    }
  }, 3000);

  // Cargamos datos dinámicos en segundo plano
  (async () => {
    try {
      if (window.initStoreSync) {
        await window.initStoreSync();
      }
      safeInit('StorePage', initializeTiendaStorePage);
      safeInit('Catalogo', initializeCatalogoPage);
      safeInit('Editable', initializeEditableContent);
      
      // Re-ejecutamos reveal por si se añadieron elementos nuevos dinámicamente
      setTimeout(() => safeInit('RevealAsync', initializeReveal), 300);
    } catch (err) {
      console.error('Error en carga asíncrona:', err);
      // Fallback: si falla la carga, revelamos todo igual
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    }
  })();
});
