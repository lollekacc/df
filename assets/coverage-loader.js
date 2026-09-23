(() => {
  const app = document.querySelector('#coverageApp[data-map-engine="maplibre"]');
  if (!app) return;
  const controllerUrl = new URL('./coverage-maplibre.js', document.currentScript.src).href;
  const styleAnchor = document.querySelector('link[rel="stylesheet"]');
  const status = document.createElement('p');
  status.className = 'coverage-load-status';
  status.hidden = true;
  status.setAttribute('role', 'status');
  (app.querySelector('.coverage-maplibre-shell') || app).append(status);
  let loading = false;
  const loaded = new Set();

  const loadAsset = (url, stylesheet = false) => {
    if (loaded.has(url)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const element = document.createElement(stylesheet ? 'link' : 'script');
      if (stylesheet) {
        element.rel = 'stylesheet';
        element.href = url;
      } else {
        element.src = url;
      }
      element.onload = () => { loaded.add(url); resolve(); };
      element.onerror = () => { element.remove(); reject(new Error('Map asset failed')); };
      if (stylesheet && styleAnchor) document.head.insertBefore(element, styleAnchor);
      else document.head.append(element);
    });
  };

  const load = async () => {
    if (loading || window.dealettCoverageMap) return;
    loading = true;
    status.hidden = false;
    status.textContent = 'Laddar täckningskartan…';
    try {
      await Promise.all([
        loadAsset('https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.css', true),
        loadAsset('https://unpkg.com/@maplibre/maplibre-gl-geocoder@1.5.0/dist/maplibre-gl-geocoder.css', true),
        loadAsset('https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.js'),
      ]);
      await loadAsset('https://unpkg.com/@maplibre/maplibre-gl-geocoder@1.5.0/dist/maplibre-gl-geocoder.min.js');
      await loadAsset(controllerUrl);
      status.remove();
    } catch {
      status.textContent = 'Kartan kunde inte laddas. ';
      const retry = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Försök igen' });
      retry.addEventListener('click', load);
      status.append(retry);
    } finally {
      loading = false;
    }
  };

  Promise.resolve(window.DEALETT_includesReady).then(() => {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        void load();
      }, {
        root: document.querySelector('.dealett-smooth-wrapper'),
        rootMargin: '1200px 0px',
      });
      observer.observe(app);
    } else {
      void load();
    }
  });
})();
