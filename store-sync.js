/**
 * Sistema de gestión de contenidos sin Firebase.
 * Usa localStorage para ediciones rápidas y permite descargar JSON para actualizar GitHub.
 */
(function () {
  const DEFAULT_SECTIONS = [
    { id: 'obras', name: 'Obras', order: 0 },
    { id: 'artesanias', name: 'Artesanías', order: 1 },
    { id: 'remeras', name: 'Remeras', order: 2 },
  ];

  const DEFAULT_PRODUCTS = [
    {
      id: 'seed-1',
      sectionId: 'obras',
      title: 'Composición Roja I',
      subtitle: 'Obra original / reproducción',
      price: '$12.500 ARS',
      image: 'img/foto1.jpeg',
      desc: 'Obra seleccionada. Consultá disponibilidad y opciones de entrega.',
      btnLabel: 'VER DETALLE',
    },
    {
      id: 'seed-2',
      sectionId: 'obras',
      title: 'Abstracción en Negro',
      subtitle: 'Obra original / reproducción',
      price: '$18.200 ARS',
      image: 'img/foto2.jpeg',
      desc: 'Pieza con carácter y profundidad. Ideal para espacios amplios y minimalistas.',
      btnLabel: 'VER DETALLE',
    },
    {
      id: 'seed-3',
      sectionId: 'artesanias',
      title: 'Texturas Urbanas',
      subtitle: 'Pieza artesanal',
      price: '$15.000 ARS',
      image: 'img/foto3.jpeg',
      desc: 'Texturas y líneas para una presencia moderna. Consultá por tamaños.',
      btnLabel: 'VER DETALLE',
    },
    {
      id: 'seed-4',
      sectionId: 'remeras',
      title: 'Serie Romero #04',
      subtitle: 'Remera / merchandising',
      price: '$21.000 ARS',
      image: 'img/foto4.jpeg',
      desc: 'Serie seleccionada. Ideal para coleccionistas y espacios de alto contraste.',
      btnLabel: 'VER DETALLE',
    },
  ];

  function normalizeSection(s) {
    return {
      id: String(s.id || `sec-${Date.now()}`),
      name: String(s.name || 'Sección').trim() || 'Sección',
      order: Number.isFinite(Number(s.order)) ? Number(s.order) : 0,
    };
  }

  function normalizeProduct(p) {
    return {
      id: String(p.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
      sectionId: String(p.sectionId || 'obras').trim() || 'obras',
      title: String(p.title || '').trim() || 'Sin título',
      subtitle: String(p.subtitle || '').trim(),
      price: String(p.price || '').trim(),
      image: String(p.image || 'img/foto1.jpeg').trim(),
      desc: String(p.desc || '').trim(),
      btnLabel: String(p.btnLabel || 'VER DETALLE').trim() || 'VER DETALLE',
    };
  }

  function normalizeStoreState(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
      version: 1,
      titulo: String(r.titulo || 'Tienda de Arte'),
      subtitulo: String(r.subtitulo || ''),
      sections: Array.isArray(r.sections) && r.sections.length
        ? r.sections.map(normalizeSection).sort((a, b) => a.order - b.order)
        : DEFAULT_SECTIONS.map(s => ({ ...s })),
      products: Array.isArray(r.products) && r.products.length
        ? r.products.map(normalizeProduct)
        : DEFAULT_PRODUCTS.map(p => ({ ...p })),
    };
  }

  window.__storeState = null;
  window.normalizeStoreState = normalizeStoreState;
  window.normalizeStoreProduct = normalizeProduct;
  window.normalizeStoreSection = normalizeSection;

  window.getStoreState = function() {
    return window.__storeState;
  };

  const loadStoreFromSupabase = async () => {
    // 1. Usar credenciales locales si existen (dueño), sino usar las públicas (visitantes)
    const sUrlLocal = localStorage.getItem('er_supabase_url');
    const sBucketLocal = localStorage.getItem('er_supabase_bucket');
    
    // Si no hay local, intentamos usar la pública expuesta en app.js
    const publicConfig = window.SUPABASE_PUBLIC || {
      url: 'https://vsjjflpufufludqphwej.supabase.co',
      bucket: 'images'
    };

    const sUrl = (sUrlLocal || publicConfig.url).replace(/\/$/, '');
    const sBucket = sBucketLocal || publicConfig.bucket;

    if (!sUrl || !sBucket) {
      console.warn('Configuración de Supabase no disponible para sincronización.');
      return;
    }

    try {
      // Agregamos timestamp para saltar cache
      const res = await fetch(`${sUrl}/storage/v1/object/public/${sBucket}/store.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' }
      });

      if (res.ok) {
        const cloud = await res.json();
        if (cloud) {
          // Si NO estamos en sesión de edición, la nube manda sobre todo
          const inSession = sessionStorage.getItem('er_owner_edit_v1') === 'true';
          if (!inSession || !localStorage.getItem('er_store_state_v1')) {
            window.__storeState = normalizeStoreState(cloud);
            localStorage.setItem('er_store_state_v1', JSON.stringify(window.__storeState));
            console.log('Sincronización global: Tienda actualizada desde la nube.');
            
            // Forzar actualización del menú de navegación dinámico
            if (typeof window.renderDynamicNavMenu === 'function') {
              window.renderDynamicNavMenu();
            }
          }
        }
      }
    } catch (e) {
      console.warn('Falla en la sincronización global de la tienda:', e);
    }
  };

  async function loadStaticStoreJson() {
    // 1. Intentar cargar desde Supabase (FUENTE DE VERDAD PRIORITARIA)
    await loadStoreFromSupabase();
    if (window.__storeState) return;

    // 2. Intentar cargar desde localStorage (respaldo local)
    const saved = localStorage.getItem('er_store_state_v1');
    if (saved) {
      try {
        window.__storeState = normalizeStoreState(JSON.parse(saved));
        return;
      } catch (e) {}
    }

    // 3. Intentar cargar desde el archivo data/store.json (el que está en GitHub)
    try {
      const r = await fetch('./data/store.json', { cache: 'no-cache' });
      if (r.ok) {
        const j = await r.json();
        window.__storeState = normalizeStoreState(j);
      }
    } catch (_) {}

    // 4. Si todo falla, usar defaults
    if (!window.__storeState) {
      window.__storeState = normalizeStoreState({});
    }
  }

  function dispatchStore() {
    window.dispatchEvent(new CustomEvent('er-store-update', { detail: window.__storeState }));
  }

  window.initStoreSync = async function initStoreSync() {
    await loadStaticStoreJson();
    dispatchStore();
  };

  window.persistStoreState = async function (state) {
    const clean = normalizeStoreState(state);
    localStorage.setItem('er_store_state_v1', JSON.stringify(clean));
    window.__storeState = clean;
    dispatchStore();
  };

  /** Función para descargar el JSON y que el usuario lo suba a GitHub */
  window.exportStoreToJson = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.__storeState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "store.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

})();
