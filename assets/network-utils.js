(() => {
  if (window.DealettNetwork) return;

  const DEFAULT_TIMEOUT_MS = 8000;
  const API_BASE = 'https://db-qtmd.onrender.com';

  const resolveResource = (resource) => {
    if (typeof resource === 'string' && resource.startsWith('/api/') && API_BASE) {
      return `${API_BASE}${resource}`;
    }

    return resource;
  };

  const createFetchError = (label, response) => {
    const error = new Error(`${label} failed with HTTP ${response.status}`);
    error.status = response.status;
    return error;
  };

  const fetchWithTimeout = async (resource, options = {}) => {
    const {
      timeoutMs = DEFAULT_TIMEOUT_MS,
      label = String(resource),
      signal,
      ...fetchOptions
    } = options;

    if (typeof AbortController === 'undefined') {
      const response = await fetch(resolveResource(resource), fetchOptions);
      if (!response.ok) throw createFetchError(label, response);
      return response;
    }

    const controller = new AbortController();
    let timeoutId = null;
    let abortExternal = null;

    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        abortExternal = () => controller.abort();
        signal.addEventListener('abort', abortExternal, { once: true });
      }
    }

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const response = await fetch(resolveResource(resource), {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (!response.ok) throw createFetchError(label, response);
      return response;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`${label} timed out`);
      }

      throw error;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (signal && abortExternal) signal.removeEventListener('abort', abortExternal);
    }
  };

  const fetchJson = async (resource, options = {}) => {
    const response = await fetchWithTimeout(resource, options);
    return response.json();
  };

  const fetchText = async (resource, options = {}) => {
    const response = await fetchWithTimeout(resource, options);
    return response.text();
  };

  window.DealettNetwork = {
    fetchJson,
    fetchText,
    fetchWithTimeout,
  };
})();
