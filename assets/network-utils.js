(() => {
  if (window.DealettNetwork) return;

  const DEFAULT_TIMEOUT_MS = 8000;
  const PRODUCTION_API_BASE = 'https://db-qtmd.onrender.com';
  const sameOriginHostnames = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const DEFAULT_API_BASE = sameOriginHostnames.has(window.location.hostname)
    ? (window.location.port === '5500' ? `http://${window.location.hostname}:3000` : '')
    : PRODUCTION_API_BASE;
  const configuredApiBase = typeof window.DEALETT_API_BASE === 'string'
    ? window.DEALETT_API_BASE
    : DEFAULT_API_BASE;
  const API_BASE = String(configuredApiBase).replace(/\/+$/, '');

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
        if (signal?.aborted) throw error;
        throw Object.assign(new Error(`${label} timed out`), { code: 'ETIMEDOUT' });
      }

      throw error;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (signal && abortExternal) signal.removeEventListener('abort', abortExternal);
    }
  };

  const fetchJson = async (resource, options = {}) => {
    const { retries = 0, retryDelayMs = 1500, ...fetchOptions } = options;
    const attempts = String(fetchOptions.method || 'GET').toUpperCase() === 'GET' ? retries : 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetchWithTimeout(resource, fetchOptions);
        return await response.json();
      } catch (error) {
        const transient = error?.code === 'ETIMEDOUT' || error?.name === 'TypeError'
          || [502, 503, 504].includes(error?.status);
        if (!transient || attempt >= attempts || fetchOptions.signal?.aborted) throw error;
        await new Promise((resolve, reject) => {
          const signal = fetchOptions.signal;
          const abort = () => {
            window.clearTimeout(timer);
            reject(signal.reason || new Error('Request cancelled'));
          };
          const timer = window.setTimeout(() => {
            signal?.removeEventListener('abort', abort);
            resolve();
          }, retryDelayMs);
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) abort();
        });
      }
    }
  };

  const fetchText = async (resource, options = {}) => {
    const response = await fetchWithTimeout(resource, options);
    return response.text();
  };

  const fetchChat = async (resource, options = {}) => {
    const { onDelta, timeoutMs = 60000, signal, label = 'Dealett assistant', ...fetchOptions } = options;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timeout = window.setTimeout(abort, timeoutMs);
    let reader;
    const started = performance.now();
    let firstTextMs = null;
    try {
      const response = await fetch(resolveResource(resource), {
        ...fetchOptions,
        headers: { ...fetchOptions.headers, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!response.ok) throw createFetchError(label, response);
      if (!response.headers.get('content-type')?.includes('text/event-stream')) return await response.json();
      if (!response.body) throw new Error('Missing chat response');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
          const block = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary[0].length);
          const lines = block.split(/\r?\n/);
          const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
          const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (!data) continue;
          const payload = JSON.parse(data);
          if (event === 'error') throw new Error(payload.error || 'Chat response failed');
          if (event === 'delta' && typeof payload.text === 'string') {
            if (firstTextMs === null) firstTextMs = Math.round(performance.now() - started);
            onDelta?.(payload.text);
          }
          if (event === 'done') {
            return { ...payload, clientPerformance: { firstTextMs, totalMs: Math.round(performance.now() - started) } };
          }
        }
        if (buffer.length > 2_000_000) throw new Error('Chat response too large');
        if (done) throw new Error('Chat response was interrupted');
      }
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  };

  window.DealettNetwork = {
    apiBase: API_BASE,
    fetchJson,
    fetchChat,
    fetchText,
    fetchWithTimeout,
    resolveResource,
  };
})();
