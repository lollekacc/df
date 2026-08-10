(function () {
  const canvas = document.querySelector("[data-codex-newsletter-bg]");
  if (!canvas) return;

  const panel = canvas.closest(".newsletter-panel");
  if (!panel) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
  });

  if (!gl) {
    panel.classList.add("codex-bg-fallback");
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform vec2 u_pulse;
    uniform float u_time;
    uniform float u_velocity;
    uniform float u_click;
    uniform float u_reduced;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amp = 0.5;
      mat2 rot = mat2(0.86, -0.5, 0.5, 0.86);

      for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p = rot * p * 2.04 + 8.7;
        amp *= 0.52;
      }

      return value;
    }

    vec3 palette(float t) {
      vec3 ink = vec3(0.018, 0.024, 0.042);
      vec3 teal = vec3(0.02, 0.42, 0.45);
      vec3 blue = vec3(0.11, 0.19, 0.44);
      vec3 copper = vec3(0.98, 0.45, 0.12);
      vec3 moss = vec3(0.46, 0.72, 0.38);

      vec3 color = mix(ink, blue, smoothstep(0.1, 1.0, t));
      color = mix(color, teal, smoothstep(0.34, 0.78, t) * 0.54);
      color = mix(color, moss, smoothstep(0.58, 0.98, t) * 0.16);
      color = mix(color, copper, pow(max(t - 0.52, 0.0), 2.0) * 0.42);
      return color;
    }

    void main() {
      vec2 uv = v_uv;
      vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
      vec2 p = (uv - 0.5) * aspect;
      vec2 pointer = (u_pointer - 0.5) * aspect;
      vec2 pulse = (u_pulse - 0.5) * aspect;

      float dist = length(p - pointer);
      float pulseDist = length(p - pulse);
      float velocity = clamp(u_velocity, 0.0, 1.0);
      float active = 1.0 - u_reduced;

      vec2 toPointer = p - pointer;
      vec2 swirl = vec2(-toPointer.y, toPointer.x) * exp(-dist * 4.8);
      float drag = (0.032 + velocity * 0.16) * active;
      float ripple = sin(pulseDist * 34.0 - u_click * 8.5) * exp(-pulseDist * 5.2) * u_click * 0.085 * active;
      vec2 warped = p + swirl * drag + normalize(toPointer + 0.0001) * ripple;

      float time = u_time * active;
      float fieldA = fbm(warped * 2.1 + vec2(time * 0.045, -time * 0.026));
      float fieldB = fbm(warped * 4.4 - vec2(time * 0.034, time * 0.052));
      float flow = fieldA * 0.62 + fieldB * 0.38;

      float contour = abs(sin((flow + warped.x * 0.42 - warped.y * 0.18) * 16.0));
      contour = pow(1.0 - contour, 3.2);

      float cursorGlow = exp(-dist * (4.8 - velocity * 2.1)) * (0.22 + velocity * 0.72) * active;
      float clickGlow = exp(-pulseDist * 3.6) * u_click * active;
      float lineGlow = contour * (0.14 + velocity * 0.34 + u_click * 0.22);

      vec2 gridUv = warped * vec2(7.0, 4.2);
      vec2 grid = abs(fract(gridUv) - 0.5);
      float mesh = 1.0 - smoothstep(0.0, 0.018, min(grid.x, grid.y));
      mesh *= 0.032 + velocity * 0.05;

      float vignette = smoothstep(0.98, 0.18, length((uv - 0.5) * vec2(1.15, 1.0)));
      float depth = smoothstep(-0.7, 0.72, warped.x - warped.y * 0.32);
      vec3 color = palette(flow + cursorGlow * 0.48 + clickGlow * 0.34);

      color += vec3(0.04, 0.54, 0.54) * cursorGlow;
      color += vec3(1.0, 0.5, 0.12) * clickGlow * 0.54;
      color += vec3(0.46, 0.9, 0.86) * lineGlow;
      color += vec3(0.52, 0.68, 0.92) * mesh;
      color *= 0.52 + depth * 0.46;
      color *= vignette;
      color += vec3(0.006, 0.008, 0.014);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || "Shader compilation failed");
    }

    return shader;
  }

  function createProgram() {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(message || "Program link failed");
    }

    return program;
  }

  let program;

  try {
    program = createProgram();
  } catch (error) {
    console.warn("Newsletter background shader disabled:", error);
    panel.classList.add("codex-bg-fallback");
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const uniforms = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    pointer: gl.getUniformLocation(program, "u_pointer"),
    pulse: gl.getUniformLocation(program, "u_pulse"),
    time: gl.getUniformLocation(program, "u_time"),
    velocity: gl.getUniformLocation(program, "u_velocity"),
    click: gl.getUniformLocation(program, "u_click"),
    reduced: gl.getUniformLocation(program, "u_reduced"),
  };

  const state = {
    pointerX: 0.5,
    pointerY: 0.45,
    targetX: 0.5,
    targetY: 0.45,
    pulseX: 0.5,
    pulseY: 0.45,
    velocity: 0,
    click: 0,
    visible: true,
    raf: 0,
    lastX: 0,
    lastY: 0,
    lastMoveTime: performance.now(),
    lastFrameTime: performance.now(),
  };

  function resize() {
    const rect = panel.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function setPointer(clientX, clientY, shouldPulse) {
    const rect = panel.getBoundingClientRect();
    const x = (clientX - rect.left) / Math.max(rect.width, 1);
    const y = 1 - (clientY - rect.top) / Math.max(rect.height, 1);
    const now = performance.now();
    const dt = Math.max(now - state.lastMoveTime, 16);
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    const speed = Math.min(Math.sqrt(dx * dx + dy * dy) / (dt / 1000) * 1.35, 1);

    state.targetX = Math.min(1, Math.max(0, x));
    state.targetY = Math.min(1, Math.max(0, y));
    state.velocity = Math.max(state.velocity, speed);
    state.lastX = state.targetX;
    state.lastY = state.targetY;
    state.lastMoveTime = now;

    if (shouldPulse) {
      state.pulseX = state.targetX;
      state.pulseY = state.targetY;
      state.click = Math.min(1, state.click + 0.92);
      start();
    }
  }

  function render(now) {
    resize();

    const reduced = prefersReducedMotion.matches ? 1 : 0;
    const dt = Math.min((now - state.lastFrameTime) / 16.67, 3);
    state.lastFrameTime = now;

    state.pointerX += (state.targetX - state.pointerX) * (0.11 + state.velocity * 0.09);
    state.pointerY += (state.targetY - state.pointerY) * (0.11 + state.velocity * 0.09);
    state.velocity *= Math.pow(0.86, dt);
    state.click *= Math.pow(0.9, dt);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.pointer, state.pointerX, state.pointerY);
    gl.uniform2f(uniforms.pulse, state.pulseX, state.pulseY);
    gl.uniform1f(uniforms.time, now * 0.001);
    gl.uniform1f(uniforms.velocity, reduced ? 0 : state.velocity);
    gl.uniform1f(uniforms.click, reduced ? 0 : state.click);
    gl.uniform1f(uniforms.reduced, reduced);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (!reduced && state.visible) {
      state.raf = window.requestAnimationFrame(render);
    } else {
      state.raf = 0;
    }
  }

  function start() {
    if (!state.raf) {
      state.lastFrameTime = performance.now();
      state.raf = window.requestAnimationFrame(render);
    }
  }

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {
      state.visible = entries.some(entry => entry.isIntersecting);
      if (state.visible) start();
    }, { threshold: 0.02 })
    : null;

  observer?.observe(panel);

  const resizeObserver = "ResizeObserver" in window
    ? new ResizeObserver(() => {
      resize();
      start();
    })
    : null;

  resizeObserver?.observe(panel);

  panel.addEventListener("pointermove", event => {
    if (prefersReducedMotion.matches) return;
    setPointer(event.clientX, event.clientY, false);
    start();
  }, { passive: true });

  panel.addEventListener("pointerdown", event => {
    if (prefersReducedMotion.matches) return;
    setPointer(event.clientX, event.clientY, true);
  }, { passive: true });

  panel.addEventListener("touchmove", event => {
    if (prefersReducedMotion.matches || !event.touches.length) return;
    const touch = event.touches[0];
    setPointer(touch.clientX, touch.clientY, false);
    start();
  }, { passive: true });

  prefersReducedMotion.addEventListener?.("change", () => {
    state.velocity = 0;
    state.click = 0;
    start();
  });

  window.addEventListener("resize", () => {
    resize();
    start();
  }, { passive: true });

  resize();
  render(performance.now());
})();
