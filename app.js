const STORAGE_KEYS = {
  reservations: 'er_reservations_v1',
  reviews: 'er_reviews_v1',
  externalReviews: 'er_external_reviews_v1',
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
    el.innerHTML = '<div class="text-gray-500">Aún no hay reservas registradas.</div>';
    return;
  }

  el.innerHTML = sorted.slice(0, 10).map(r => {
    const adults = Number(r.adults || 0);
    const minors = Number(r.minors || 0);
    const guests = r.guests ? ` · ${r.guests} huésped${String(r.guests) === '1' ? '' : 'es'}` : '';
    const breakdown = adults || minors ? ` · ${adults} adulto${adults === 1 ? '' : 's'} · ${minors} menor${minors === 1 ? '' : 'es'}` : '';
    return `<div class="flex items-start justify-between gap-3">
      <div class="text-gray-300">${formatDateEs(r.checkin)} → ${formatDateEs(r.checkout)}${guests}${breakdown}</div>
      <div class="text-xs text-gray-600">${r.name ? String(r.name).split(' ')[0] : ''}</div>
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

function initializeBooking() {
  const ADULT_RATE_USD = 30;
  const MINOR_RATE_USD = 15;
  const MAX_GUESTS = 6;
  const HOST_EMAIL = 'espacioromero.ar@gmail.com';
  
  // CONFIGURACIÓN EMAILJS (Completar con tus IDs)
  const EMAILJS_PUBLIC_KEY = 'DIJitKY8Rmo9SLlOM'; 
  const EMAILJS_SERVICE_ID = 'service_3ltca0p'; 
  const EMAILJS_TEMPLATE_ID = 'template_i9libhf'; 

  const bookingForm = document.getElementById('booking-form');
  const successMsg = document.getElementById('success-msg');
  const bookingSummary = document.getElementById('booking-summary');
  const newBookingBtn = document.getElementById('new-booking-btn');
  const clearReservationsBtn = document.getElementById('clear-reservations-btn');
  const submitBtn = document.getElementById('booking-submit');
  if (!bookingForm || !successMsg) return;

  const nameInput = document.getElementById('bk-name');
  const emailInput = document.getElementById('bk-email');
  const phoneInput = document.getElementById('bk-phone');
  const checkinInput = document.getElementById('bk-checkin');
  const checkoutInput = document.getElementById('bk-checkout');
  const adultsInput = document.getElementById('bk-adults');
  const minorsInput = document.getElementById('bk-minors');
  const nightsEl = document.getElementById('bk-nights');
  const checkinLabelEl = document.getElementById('bk-checkin-label');
  const checkoutLabelEl = document.getElementById('bk-checkout-label');
  const adultsLabelEl = document.getElementById('bk-adults-label');
  const minorsLabelEl = document.getElementById('bk-minors-label');
  const totalUsdEl = document.getElementById('bk-total-usd');

  const today = new Date();
  const todayIso = dateToIso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
  if (checkinInput) checkinInput.min = todayIso;
  if (checkoutInput) checkoutInput.min = todayIso;
  const calendarContainer = document.getElementById('availability-calendar');
  const calendarWrap = document.getElementById('availability-calendar-wrap');
  const calendarHint = document.getElementById('calendar-hint');
  const calendarMonthLabel = document.getElementById('calendar-month-label');
  const calendarPrevBtn = document.getElementById('calendar-prev');
  const calendarNextBtn = document.getElementById('calendar-next');
  let calendarMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  let calendarMonthShouldAnimate = false;

  // Sincronizar reservas: solo local
  let reservations = getStoredList(STORAGE_KEYS.reservations);
  renderReservationsList(reservations);

  function setBookingSubmitEnabled(enabled) {
    if (!submitBtn) return;
    if (enabled) {
      submitBtn.removeAttribute('disabled');
      submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
    } else {
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    }
  }

  function isBookedDay(iso, reservations) {
    const day = toDateOnly(iso);
    if (!day) return false;
    return reservations.some(r => {
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
    if (!checkinInput || !checkoutInput) return;
    if (iso < todayIso) return;
    const list = getStoredList(STORAGE_KEYS.reservations);
    if (isBookedDay(iso, list)) return;

    const ci = checkinInput.value || '';
    const co = checkoutInput.value || '';

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
    const reservations = getStoredList(STORAGE_KEYS.reservations);
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
        placeholder.textContent = String(cellDate.getUTCDate());
        placeholder.setAttribute('aria-hidden', 'true');
        calendarContainer.appendChild(placeholder);
        continue;
      }

      const booked = isBookedDay(iso, reservations);
      const past = iso < todayIso;
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

  function getGuestBreakdown() {
    const adults = Number(adultsInput?.value || 1);
    const minors = Number(minorsInput?.value || 0);
    const total = adults + minors;
    return { adults, minors, total };
  }

  function getNightsCount(checkin, checkout) {
    if (!isValidRange(checkin, checkout)) return 0;
    const s = toDateOnly(checkin);
    const e = toDateOnly(checkout);
    return s && e ? Math.round((e.getTime() - s.getTime()) / 86400000) : 0;
  }

  function computeTotalUsd(nights, adults, minors) {
    return Math.max(0, nights) * ((adults * ADULT_RATE_USD) + (minors * MINOR_RATE_USD));
  }

  function updateBookingDetails() {
    if (!nightsEl || !checkinLabelEl || !checkoutLabelEl) return;
    const checkin = checkinInput?.value || '';
    const checkout = checkoutInput?.value || '';
    const { adults, minors } = getGuestBreakdown();
    if (adultsLabelEl) adultsLabelEl.textContent = String(adults);
    if (minorsLabelEl) minorsLabelEl.textContent = String(minors);

    if (!checkin || !checkout || !isValidRange(checkin, checkout)) {
      nightsEl.textContent = '-';
      checkinLabelEl.textContent = checkin ? formatDateEs(checkin) : '-';
      checkoutLabelEl.textContent = checkout ? formatDateEs(checkout) : '-';
      if (totalUsdEl) totalUsdEl.textContent = '-';
      return;
    }

    const nights = getNightsCount(checkin, checkout);
    nightsEl.textContent = String(Math.max(1, nights));
    checkinLabelEl.textContent = formatDateEs(checkin);
    checkoutLabelEl.textContent = formatDateEs(checkout);
    const totalUsd = computeTotalUsd(nights, adults, minors);
    if (totalUsdEl) totalUsdEl.textContent = `USD ${totalUsd}`;
  }

  function syncCheckoutMin() {
    if (!checkinInput?.value || !checkoutInput) return;
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
    setBookingError('');
    const checkin = checkinInput?.value || '';
    const checkout = checkoutInput?.value || '';
    const { adults, minors, total } = getGuestBreakdown();
    if (total > MAX_GUESTS) {
      setAvailabilityStatus({ type: 'error', text: `Máximo ${MAX_GUESTS} personas por reserva.` });
      setBookingError(`La suma de adultos y menores no puede superar ${MAX_GUESTS}.`);
      updateBookingDetails();
      setBookingSubmitEnabled(false);
      renderAvailabilityCalendar();
      return;
    }
    if (adults < 1) {
      setAvailabilityStatus({ type: 'error', text: 'Debe haber al menos 1 adulto.' });
      setBookingError('Agregá al menos 1 adulto (12+).');
      updateBookingDetails();
      setBookingSubmitEnabled(false);
      renderAvailabilityCalendar();
      return;
    }
    if (calendarHint) {
      if (!checkin) {
        calendarHint.innerHTML = 'Tocá el día de <strong class="text-white">llegada</strong> y después el de <strong class="text-white">salida</strong>. Los días ocupados no se pueden elegir.';
      } else if (!checkout) {
        calendarHint.innerHTML = 'Elegí el día de <strong class="text-white">salida</strong> (debe ser posterior a la llegada).';
      } else {
        calendarHint.innerHTML = 'Podés tocar otra fecha de <strong class="text-white">llegada</strong> para cambiar el rango.';
      }
    }
    if (!checkin || !checkout) {
      setAvailabilityStatus({ type: 'info', text: 'Seleccioná fechas para ver disponibilidad.' });
      updateBookingDetails();
      setBookingSubmitEnabled(false);
      renderAvailabilityCalendar();
      return;
    }
    if (!isValidRange(checkin, checkout)) {
      setAvailabilityStatus({ type: 'error', text: 'La fecha de salida debe ser posterior a la llegada.' });
      updateBookingDetails();
      setBookingSubmitEnabled(false);
      renderAvailabilityCalendar();
      return;
    }
    const current = getStoredList(STORAGE_KEYS.reservations);
    const conflict = getReservationConflict(current, checkin, checkout);
    if (conflict) {
      setAvailabilityStatus({ type: 'error', text: 'No disponible en esas fechas. Elegí otras fechas.' });
      updateBookingDetails();
      setBookingSubmitEnabled(false);
      renderAvailabilityCalendar();
      return;
    }
    setAvailabilityStatus({ type: 'ok', text: 'Disponible. Podés confirmar la reserva.' });
    updateBookingDetails();
    setBookingSubmitEnabled(true);
    renderAvailabilityCalendar();
  }

  checkinInput?.addEventListener('change', () => {
    syncCheckoutMin();
    updateAvailability();
  });
  checkoutInput?.addEventListener('change', updateAvailability);
  adultsInput?.addEventListener('change', updateAvailability);
  minorsInput?.addEventListener('change', updateAvailability);

  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setBookingError('');
    setBookingSubmitEnabled(false);
    if (submitBtn) {
      submitBtn.classList.add('opacity-80');
      submitBtn.innerHTML = 'Confirmando <i class="fas fa-circle-notch fa-spin"></i>';
    }
    const checkin = checkinInput?.value || '';
    const checkout = checkoutInput?.value || '';
    const { adults, minors, total } = getGuestBreakdown();
    if (total > MAX_GUESTS) {
      setBookingError(`La suma de adultos y menores no puede superar ${MAX_GUESTS}.`);
      setAvailabilityStatus({ type: 'error', text: `Máximo ${MAX_GUESTS} personas por reserva.` });
      if (submitBtn) {
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'CONFIRMAR RESERVA';
      }
      updateAvailability();
      return;
    }
    if (adults < 1) {
      setBookingError('Agregá al menos 1 adulto (12+).');
      setAvailabilityStatus({ type: 'error', text: 'Debe haber al menos 1 adulto.' });
      if (submitBtn) {
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'CONFIRMAR RESERVA';
      }
      updateAvailability();
      return;
    }
    if (!isValidRange(checkin, checkout)) {
      setBookingError('Revisá las fechas: la salida debe ser posterior a la llegada.');
      setAvailabilityStatus({ type: 'error', text: 'Fechas inválidas.' });
      if (submitBtn) {
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'CONFIRMAR RESERVA';
      }
      updateAvailability();
      return;
    }

    const current = getStoredList(STORAGE_KEYS.reservations);
    const conflict = getReservationConflict(current, checkin, checkout);
    if (conflict) {
      setBookingError('Esas fechas ya están reservadas. Elegí otras fechas.');
      setAvailabilityStatus({ type: 'error', text: 'No disponible.' });
      if (submitBtn) {
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'CONFIRMAR RESERVA';
      }
      updateAvailability();
      return;
    }

    const nights = getNightsCount(checkin, checkout);
    const totalUsd = computeTotalUsd(nights, adults, minors);
    const reservation = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: String(nameInput?.value || '').trim(),
      email: String(emailInput?.value || '').trim(),
      phone: String(phoneInput?.value || '').trim(),
      checkin,
      checkout,
      adults,
      minors,
      guests: total,
      totalUsd,
      createdAt: new Date().toISOString(),
    };

    // Enviar email vía EmailJS (Notifica a dueño y huésped)
    const sendEmail = async (res) => {
      if (typeof emailjs === 'undefined' || EMAILJS_PUBLIC_KEY === 'TU_PUBLIC_KEY' || !EMAILJS_PUBLIC_KEY) {
        console.warn('EmailJS no configurado o sin llave pública. El mail no se envió.');
        return true; 
      }

      try {
        emailjs.init(EMAILJS_PUBLIC_KEY);
        const templateParams = {
          to_name: res.name,
          to_email: res.email,
          from_name: 'Espacio Romero',
          host_email: HOST_EMAIL,
          llegada: formatDateEs(res.checkin),
          salida: formatDateEs(res.checkout),
          adultos: res.adults,
          menores: res.minors,
          total_usd: `USD ${res.totalUsd}`,
          phone: res.phone || 'No especificado',
          fecha_registro: new Date(res.createdAt).toLocaleString('es-AR')
        };

        const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        return response.status === 200;
      } catch (e) {
        console.error('Error sending email with EmailJS:', e);
        return false;
      }
    };

    // Solo enviamos el email y guardamos localmente
    sendEmail(reservation).then(() => {
      const next = [reservation, ...getStoredList(STORAGE_KEYS.reservations)].slice(0, 100);
      setStoredList(STORAGE_KEYS.reservations, next);
      renderReservationsList(next);

      if (bookingSummary) {
        const phoneText = reservation.phone ? ` · ${reservation.phone}` : '';
        const safeName = escapeHtml(reservation.name);
        const safePhone = escapeHtml(phoneText);
        bookingSummary.innerHTML = `
          <div class="bg-zinc-900/50 p-4 rounded-lg border border-green-500/30 mb-4">
            <p class="text-white font-semibold mb-2">Detalles de tu reserva:</p>
            <p class="text-gray-300">${safeName} · ${formatDateEs(checkin)} → ${formatDateEs(checkout)}</p>
            <p class="text-gray-300">${reservation.adults} adulto${reservation.adults === 1 ? '' : 's'} · ${reservation.minors} menor${reservation.minors === 1 ? '' : 'es'}${safePhone}</p>
            <p class="text-white mt-2">Tarifa estimada: <strong class="text-green-400">USD ${reservation.totalUsd}</strong></p>
            <p class="text-xs text-gray-500 mt-2 italic">Se ha enviado un correo de notificación a la administración.</p>
          </div>
        `;
      }

      bookingForm.classList.add('hidden');
      successMsg.classList.remove('hidden');
      setAvailabilityStatus({ type: 'ok', text: 'Reserva confirmada.' });

      if (submitBtn) {
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'CONFIRMAR RESERVA';
      }
      updateAvailability();
    }).catch(err => {
      console.error('Booking final steps error:', err);
      setBookingError('Hubo un problema al procesar la reserva. Por favor contactanos por WhatsApp.');
      if (submitBtn) {
        submitBtn.classList.remove('opacity-80');
        submitBtn.innerHTML = 'REINTENTAR';
        setBookingSubmitEnabled(true);
      }
    });
  });

  newBookingBtn?.addEventListener('click', () => {
    bookingForm.reset();
    setBookingError('');
    setAvailabilityStatus({ type: 'info', text: 'Seleccioná fechas para ver disponibilidad.' });
    successMsg.classList.add('hidden');
    bookingForm.classList.remove('hidden');
    if (checkoutInput) checkoutInput.min = todayIso;
    const ratingInput = document.getElementById('rev-rating');
    if (ratingInput) ratingInput.value = 5;
    const label = document.getElementById('rating-label');
    if (label) label.textContent = '5/5';
    updateAvailability();
  });

  const isOwner = isOwnerEditSession();
  const reservationsContainer = document.getElementById('reservations-list')?.closest('.mt-12.border-t');
  
  if (!isOwner) {
    if (clearReservationsBtn) clearReservationsBtn.classList.add('hidden');
    if (reservationsContainer) reservationsContainer.classList.add('hidden');
  }

  clearReservationsBtn?.addEventListener('click', () => {
    if (!isOwnerEditSession()) return;
    const ok = confirm('¿Seguro que querés limpiar todas las reservas locales?');
    if (!ok) return;
    setStoredList(STORAGE_KEYS.reservations, []);
    renderReservationsList([]);
    updateAvailability();
  });

  calendarPrevBtn?.addEventListener('click', () => {
    calendarMonthShouldAnimate = true;
    calendarMonthDate = new Date(Date.UTC(calendarMonthDate.getUTCFullYear(), calendarMonthDate.getUTCMonth() - 1, 1));
    renderAvailabilityCalendar();
  });
  calendarNextBtn?.addEventListener('click', () => {
    calendarMonthShouldAnimate = true;
    calendarMonthDate = new Date(Date.UTC(calendarMonthDate.getUTCFullYear(), calendarMonthDate.getUTCMonth() + 1, 1));
    renderAvailabilityCalendar();
  });

  updateAvailability();
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

function buildProductCardEl(p) {
  const div = document.createElement('div');
  div.className = 'bg-black border border-zinc-800 overflow-hidden group reveal is-visible';
  div.innerHTML = `
    <div class="relative">
      <img src="${escapeAttr(p.image)}" data-fallback="foto1.jpeg" alt="${escapeAttr(p.title)}" class="w-full h-56 object-cover group-hover:scale-105 transition duration-500">
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
        <button type="button" class="bg-brand-red text-white px-6 py-2 font-bold product-detail-btn"
          data-title="${escapeAttr(p.title)}"
          data-price="${escapeAttr(p.price)}"
          data-img="${escapeAttr(p.image)}"
          data-desc="${escapeAttr(p.desc)}">${escapeHtml(p.btnLabel)}</button>
      </div>
    </div>
    <div class="p-4">
      <h2 class="font-bold text-lg">${escapeHtml(p.title)}</h2>
      <p class="text-white/80 text-sm">${escapeHtml(p.subtitle)}</p>
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
  grid.innerHTML = '';
  sections.forEach(sec => {
    const secProds = products.filter(p => p.sectionId === sec.id);
    if (secProds.length === 0) return;
    const wrap = document.createElement('section');
    wrap.id = `tienda-${sec.id}`;
    wrap.className = 'store-section';
    const h = document.createElement('h2');
    h.className = 'text-2xl font-serif font-bold tracking-widest text-brand-red/90 mb-6 mt-10 first:mt-0 border-b border-zinc-800 pb-2';
    h.textContent = sec.name;
    wrap.appendChild(h);
    const subGrid = document.createElement('div');
    subGrid.className = 'grid sm:grid-cols-2 lg:grid-cols-4 gap-6';
    secProds.forEach(p => subGrid.appendChild(buildProductCardEl(p)));
    wrap.appendChild(subGrid);
    grid.appendChild(wrap);
  });
  initializeImageFallbacks();
}

function renderCatalogoPage(root) {
  if (!root) return;
  const st = window.getStoreState?.();
  if (!st) return;
  const products = st.products || [];
  const sections = [...(st.sections || [])].sort((a, b) => a.order - b.order);
  root.innerHTML = '';
  sections.forEach(sec => {
    const secProds = products.filter(p => p.sectionId === sec.id);
    if (secProds.length === 0) return;
    const wrap = document.createElement('section');
    wrap.className = 'catalogo-section mb-16 md:mb-24';
    const head = document.createElement('div');
    head.className = 'flex flex-wrap items-baseline gap-4 mb-8';
    head.innerHTML = `
      <h2 class="text-3xl md:text-4xl font-serif font-bold text-white">${escapeHtml(sec.name)}</h2>
      <span class="text-sm text-gray-500 uppercase tracking-widest">${secProds.length} ${secProds.length === 1 ? 'pieza' : 'piezas'}</span>
    `;
    wrap.appendChild(head);
    const subGrid = document.createElement('div');
    subGrid.className = 'grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8';
    secProds.forEach(p => subGrid.appendChild(buildProductCardEl(p)));
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

function initializeTiendaStorePage() {
  if (!document.getElementById('store-grid')) return;
  syncTiendaFromState();
  document.addEventListener('er-store-update', () => syncTiendaFromState());
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
          <input type="text" class="er-inp-img w-full text-xl p-4 bg-black border-2 border-zinc-600 rounded-lg text-white" value="${escapeAttr(prod.image)}" placeholder="foto1.jpeg">
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
      <div class="max-w-3xl mx-auto my-4 bg-zinc-900 border-2 border-zinc-500 rounded-xl p-6 md:p-8">
        <h2 class="text-3xl font-serif font-bold text-white mb-2">Gestionar la tienda</h2>
        <div class="bg-amber-900/20 border border-amber-700/50 p-4 rounded-lg mb-6">
          <p class="text-amber-200 text-sm leading-relaxed italic">
            <strong>Instrucciones para los dueños:</strong><br>
            1. Editá lo que quieras abajo.<br>
            2. Tocá el botón verde <strong>Guardar Cambios Localmente</strong>.<br>
            3. Tocá el botón azul <strong>Descargar Archivo para GitHub</strong>.<br>
            4. Subí el archivo descargado (store.json) a la carpeta <strong>data/</strong> de tu GitHub para que todos vean los cambios.
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
          <button type="button" id="er-tienda-save" class="w-full py-6 text-xl font-bold rounded-lg bg-green-700 hover:bg-green-600 text-white">1. Guardar Cambios</button>
          <button type="button" id="er-tienda-export" class="w-full py-6 text-xl font-bold rounded-lg bg-blue-700 hover:bg-blue-600 text-white">2. Descargar para GitHub</button>
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
      try {
        await window.persistStoreState(state);
        persistTiendaHeader(titulo, subtitulo);
        syncTiendaFromState();
        window.alert('¡Cambios guardados en este navegador! Ahora recordá descargar el archivo con el botón azul y subirlo a GitHub para que sea permanente.');
      } catch (ex) {
        window.alert(ex?.message || String(ex));
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

    overlay.querySelector('#er-tienda-close')?.addEventListener('click', () => {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
    });
  }

  const onEsc = e => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);

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
    try {
      const r = await fetch('./data/pages.json', { cache: 'no-cache' });
      if (r.ok) {
        const remotePages = await r.json();
        // Solo guardamos en localStorage si no hay nada guardado ya para esa página específica
        // para no pisar los cambios que el dueño esté haciendo localmente antes de exportar.
        if (remotePages[pageId]) {
          const localData = safeJsonParse(localStorage.getItem(pageKey), null);
          if (!localData) {
            localStorage.setItem(pageKey, JSON.stringify(remotePages[pageId]));
            saved = remotePages[pageId];
            applySavedContent();
          }
        }
        // Guardamos todo el objeto para poder exportarlo después si es necesario
        window.__remotePages = remotePages;
      }
    } catch (_) {}
  }

  function applySavedContent() {
    editableItems.forEach((el) => {
      const key = el.getAttribute('data-edit-key');
      if (!key) return;
      if (useTiendaStore && key === 'tienda_titulo' && typeof st.titulo === 'string') {
        applyTextToEditableEl(el, key, st.titulo);
        return;
      }
      if (useTiendaStore && key === 'tienda_subtitulo') {
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

  // ... (resto del código del panel de edición)

  if (document.getElementById('store-grid')) {
    const panel = document.createElement('div');
    panel.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 flex flex-col gap-3';
    panel.innerHTML = `
      <button type="button" id="er-tienda-gestionar" class="w-full py-6 px-5 text-2xl font-bold rounded-lg bg-green-700 hover:bg-green-600 text-white shadow-lg border-2 border-green-500/50">
        Gestionar la tienda
      </button>
      <p class="text-center text-base text-gray-400 px-1 leading-snug">Acá cambian obras, precios, fotos y textos. También el título de la página.</p>
      <button type="button" id="er-owner-exit-tienda" class="w-full py-4 px-4 text-xl rounded-lg bg-zinc-900 border border-zinc-600 hover:border-white text-gray-200">
        Salir
      </button>
    `;
    document.body.appendChild(panel);
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
      // Los datos de la galería se manejan un poco distinto porque vienen del modal
      // Si ya están en el storage local, los preservamos aquí
      if (saved[key]) next[key] = saved[key];
    });
    localStorage.setItem(pageKey, JSON.stringify(next));
  };

  const panel = document.createElement('div');
  panel.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 flex flex-col gap-3';
  panel.innerHTML = `
    <button type="button" id="er-owner-open-editor" class="w-full py-5 px-6 text-xl font-bold rounded-sm bg-brand-red hover:bg-brand-dark-red text-white shadow-lg border border-brand-red/40">
      Editar textos de esta página
    </button>
    <button type="button" id="er-owner-exit-btn" class="w-full py-3 px-4 text-lg rounded-sm bg-zinc-900 border border-zinc-600 hover:border-white text-gray-200">
      Salir (ocultar botones de edición)
    </button>
  `;
  document.body.appendChild(panel);

  const openBtn = panel.querySelector('#er-owner-open-editor');
  const exitBtn = panel.querySelector('#er-owner-exit-btn');

  exitBtn?.addEventListener('click', () => {
    sessionStorage.removeItem(ER_OWNER_SESSION_KEY);
    window.location.reload();
  });

function openOwnerEditorModal() {
    const overlay = document.createElement('div');
    overlay.id = 'er-owner-editor-overlay';
    overlay.className = 'fixed inset-0 z-[200] bg-black/92 overflow-y-auto p-4 flex items-start justify-center';
    overlay.innerHTML = `
      <div class="w-full max-w-2xl my-6 bg-zinc-900 border-2 border-zinc-600 rounded-lg p-6 md:p-8 shadow-2xl">
        <div class="bg-blue-900/20 border border-blue-700/50 p-4 rounded-lg mb-6">
          <p class="text-blue-200 text-sm leading-relaxed italic">
            <strong>Cómo publicar cambios en todo el sitio:</strong><br>
            1. Editá los textos abajo y tocá <strong>Guardar cambios</strong>.<br>
            2. Tocá el botón azul <strong>Descargar textos para GitHub</strong>.<br>
            3. Subí el archivo (pages.json) a la carpeta <strong>data/</strong> de tu GitHub.
          </p>
        </div>
        <div class="flex border-b border-zinc-800 mb-6">
          <button id="er-tab-content" class="px-6 py-3 text-lg font-bold border-b-2 border-brand-red text-white">Contenido</button>
          <button id="er-tab-reviews" class="px-6 py-3 text-lg font-bold text-gray-500 hover:text-white transition">Reseñas</button>
        </div>
        
        <div id="er-editor-content-pane">
          <h2 class="text-2xl md:text-3xl font-serif font-bold text-white mb-2">Cambiar textos</h2>
          <div id="er-owner-fields" class="space-y-6 mb-8"></div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <button type="button" id="er-owner-save" class="w-full py-5 text-xl font-bold rounded-sm bg-green-700 hover:bg-green-600 text-white">1. Guardar cambios</button>
            <button type="button" id="er-owner-export" class="w-full py-5 text-xl font-bold rounded-sm bg-blue-700 hover:bg-blue-600 text-white">2. Descargar para GitHub</button>
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
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = `er-field-${key}`;
      inp.dataset.editImage = key;
      inp.className = 'w-full text-lg md:text-xl p-4 bg-black border-2 border-zinc-600 rounded-sm text-white';
      inp.value = img.getAttribute('src') || '';
      wrap.appendChild(lab);
      wrap.appendChild(inp);
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
              <button type="button" class="er-gal-remove text-red-500 p-2"><i class="fas fa-trash"></i></button>
            </div>
          `).join('')}
        </div>
        <button type="button" id="er-gal-add-${key}" class="w-full py-3 border-2 border-dashed border-zinc-600 rounded text-gray-400 hover:text-white hover:border-white transition">+ Agregar otra foto</button>
      `;
      fieldsRoot?.appendChild(wrap);

      const listContainer = wrap.querySelector(`#er-gal-list-${key}`);
      const addBtn = wrap.querySelector(`#er-gal-add-${key}`);

      const updateListEvents = () => {
        listContainer.querySelectorAll('.er-gal-remove').forEach(btn => {
          btn.onclick = () => {
            btn.closest('.er-gal-item').remove();
          };
        });
      };

      updateListEvents();

      addBtn.onclick = () => {
        const div = document.createElement('div');
        div.className = 'flex gap-2 items-center er-gal-item';
        div.innerHTML = `
          <div class="w-12 h-12 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center text-gray-500"><i class="fas fa-image"></i></div>
          <input type="text" placeholder="img/fotoX.jpeg" class="flex-1 p-3 bg-black border-2 border-zinc-600 rounded text-white text-sm" value="">
          <button type="button" class="er-gal-remove text-red-500 p-2"><i class="fas fa-trash"></i></button>
        `;
        listContainer.appendChild(div);
        updateListEvents();
      };
    });

    const onEsc = (e) => {
      if (e.key === 'Escape') close();
    };
    const close = () => {
      document.removeEventListener('keydown', onEsc);
      overlay.remove();
    };
    document.addEventListener('keydown', onEsc);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

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
        window.alert('¡Cambios guardados localmente! Para que sean permanentes para todos, recordá usar el botón de exportar JSON si estás en la tienda, o el sistema de sincronización manual.');
      } catch (err) {
        console.error('Error al guardar:', err);
        window.alert('Hubo un error al intentar guardar los cambios localmente.');
      }
    });
  }

  openBtn?.addEventListener('click', openOwnerEditorModal);
}

function initializeNavigation() {
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  menuBtn?.addEventListener('click', () => {
    if (!mobileMenu) return;
    mobileMenu.classList.toggle('hidden');
    const icon = menuBtn.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-xmark');
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        const icon = menuBtn?.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-xmark');
        }
      }
    });
  });
}

function initializeScrollAnimations() {
  const candidates = Array.from(
    document.querySelectorAll('section, main .bg-black, main .bg-brand-black, main .bg-zinc-900')
  ).filter(el => !el.classList.contains('reveal'));

  if (candidates.length === 0) return;

  candidates.forEach(el => el.classList.add('scroll-animate'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-scrolled');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

  candidates.forEach((el) => observer.observe(el));
}

function initializeReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length === 0) return;
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        // Opcional: unobserve si solo quieres que pase una vez
        // revealObserver.unobserve(entry.target);
      } else {
        // Opcional: quitar clase para que se repita la animación al scrollear
        // entry.target.classList.remove('is-visible');
      }
    });
  }, { 
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach((el, index) => {
    // Escalonar la aparición inicial si están cerca
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.style.transitionDelay = `${index * 100}ms`;
    }
    revealObserver.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeNavigation();
  initializeHeroBackground();
  await (window.initStoreSync?.() ?? Promise.resolve());
  initializePropietariosLogin();
  initializeTiendaStorePage();
  initializeCatalogoPage();
  initializeImageFallbacks();
  initializeBooking();
  initializeReviews();
  initializeStore();
  initializeEditableContent();
  initializeReveal();
  initializeScrollAnimations();
});
