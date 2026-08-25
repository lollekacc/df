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
    uniform vec3 u_trail[40];
    uniform vec4 u_clicks[10];
    uniform float u_time;
    uniform float u_velocity;
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
      vec3 ink = vec3(0.03, 0.06, 0.16);
      vec3 indigo = vec3(0.2, 0.29, 0.68);
      vec3 periwinkle = vec3(0.49, 0.54, 0.95);
      vec3 cyan = vec3(0.23, 0.66, 0.75);
      vec3 violet = vec3(0.61, 0.43, 0.86);

      vec3 color = mix(ink, indigo, smoothstep(0.08, 0.72, t));
      color = mix(color, periwinkle, smoothstep(0.48, 1.0, t) * 0.62);
      color = mix(color, cyan, smoothstep(0.62, 0.96, t) * 0.32);
      color = mix(color, violet, smoothstep(0.76, 1.08, t) * 0.25);
      return color;
    }

    void main() {
      vec2 uv = v_uv;
      vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
      vec2 p = (uv - 0.5) * aspect;
      vec2 pointer = (u_pointer - 0.5) * aspect;

      float dist = length(p - pointer);
      float velocity = clamp(u_velocity, 0.0, 1.0);
      float active = 1.0 - u_reduced;

      vec2 toPointer = p - pointer;
      vec2 swirl = vec2(-toPointer.y, toPointer.x) * exp(-dist * 3.4);
      float drag = (0.018 + velocity * 0.09) * active;
      vec2 warped = p + swirl * drag;

      float time = u_time * active;
      float fieldA = fbm(warped * 1.55 + vec2(time * 0.025, -time * 0.018));
      float fieldB = fbm(warped * 3.0 - vec2(time * 0.018, time * 0.026));
      float flow = fieldA * 0.7 + fieldB * 0.3;

      float trailDots = 0.0;
      float trailGlow = 0.0;

      for (int i = 0; i < 40; i++) {
        vec2 trailPoint = (u_trail[i].xy - 0.5) * aspect;
        float trailStrength = u_trail[i].z;
        float trailDist = length(p - trailPoint);
        trailDots += (1.0 - smoothstep(0.025, 0.2 + velocity * 0.035, trailDist))
          * trailStrength;
        trailGlow += exp(-trailDist * 4.2) * trailStrength * 0.12;
      }

      float cursorGlow = trailGlow * active;

      vec2 dotCell = fract(gl_FragCoord.xy / 12.0) - 0.5;
      float dotShape = 1.0 - smoothstep(0.08, 0.18, length(dotCell));
      float cursorDots = trailDots * active;

      float clickDots = 0.0;

      for (int i = 0; i < 10; i++) {
        vec2 clickPoint = (u_clicks[i].xy - 0.5) * aspect;
        float clickAge = u_clicks[i].z;
        float clickActive = u_clicks[i].w
          * (1.0 - smoothstep(1.05, 1.42, clickAge))
          * active;
        float clickDistance = length(p - clickPoint);
        float waveRadius = clickAge * 0.92;
        float wave = 1.0 - smoothstep(0.035, 0.14, abs(clickDistance - waveRadius));
        float wake = (1.0 - smoothstep(0.0, max(waveRadius, 0.001), clickDistance))
          * (1.0 - smoothstep(0.0, 1.22, clickAge))
          * 0.52;
        clickDots += (wave + wake) * clickActive;
      }

      float dotField = dotShape * (cursorDots * 0.94 + clickDots);

      float vignette = smoothstep(0.98, 0.18, length((uv - 0.5) * vec2(1.15, 1.0)));
      float depth = smoothstep(-0.7, 0.72, warped.x - warped.y * 0.32);
      vec3 color = palette(flow + cursorGlow * 0.16);

      color += vec3(0.12, 0.42, 0.62) * cursorGlow * 0.22;
      color *= 0.72 + depth * 0.32;
      color *= 0.7 + vignette * 0.3;
      color += mix(vec3(0.58, 0.9, 1.0), vec3(0.9, 0.8, 1.0), uv.x) * dotField * 1.08;
      color += vec3(0.008, 0.012, 0.026);

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
    trail: gl.getUniformLocation(program, "u_trail[0]"),
    clicks: gl.getUniformLocation(program, "u_clicks[0]"),
    time: gl.getUniformLocation(program, "u_time"),
    velocity: gl.getUniformLocation(program, "u_velocity"),
    reduced: gl.getUniformLocation(program, "u_reduced"),
  };

  const state = {
    pointerX: 0.5,
    pointerY: 0.45,
    targetX: 0.5,
    targetY: 0.45,
    velocity: 0,
    visible: true,
    raf: 0,
    lastX: 0,
    lastY: 0,
    lastMoveTime: performance.now(),
    lastFrameTime: performance.now(),
    lastTrailX: 0.5,
    lastTrailY: 0.45,
    trailConnected: false,
    trail: Array.from({ length: 40 }, () => ({ x: 0.5, y: 0.45, strength: 0 })),
    trailUniform: new Float32Array(120),
    clicks: Array.from({ length: 10 }, () => ({ x: 0.5, y: 0.45, age: -1 })),
    clicksUniform: new Float32Array(40),
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

    if (!state.trailConnected) {
      state.trail.pop();
      state.trail.unshift({ x: state.targetX, y: state.targetY, strength: 1 });
      state.trailConnected = true;
      state.lastTrailX = state.targetX;
      state.lastTrailY = state.targetY;
    } else {
      const fromX = state.lastTrailX;
      const fromY = state.lastTrailY;
      const trailDistance = Math.hypot(state.targetX - fromX, state.targetY - fromY);
      const segmentCount = Math.floor(trailDistance / 0.035);

      if (segmentCount > 0) {
        for (let index = 1; index <= segmentCount; index += 1) {
          const progress = Math.min(1, index * 0.035 / trailDistance);
          state.trail.pop();
          state.trail.unshift({
            x: fromX + (state.targetX - fromX) * progress,
            y: fromY + (state.targetY - fromY) * progress,
            strength: 1,
          });
        }
        const coveredProgress = Math.min(1, segmentCount * 0.035 / trailDistance);
        state.lastTrailX = fromX + (state.targetX - fromX) * coveredProgress;
        state.lastTrailY = fromY + (state.targetY - fromY) * coveredProgress;
      }

      state.trail[0].x = state.targetX;
      state.trail[0].y = state.targetY;
      state.trail[0].strength = 1;
    }

    if (shouldPulse) {
      const availableClick = state.clicks.find(click => click.age < 0)
        || state.clicks.reduce((oldest, click) => click.age > oldest.age ? click : oldest);
      availableClick.x = state.targetX;
      availableClick.y = state.targetY;
      availableClick.age = 0;
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
    state.trail.forEach((point, index) => {
      point.strength *= Math.pow(0.98, dt);
      if (point.strength < 0.001) point.strength = 0;
      const offset = index * 3;
      state.trailUniform[offset] = point.x;
      state.trailUniform[offset + 1] = point.y;
      state.trailUniform[offset + 2] = point.strength;
    });
    state.clicks.forEach((click, index) => {
      if (click.age >= 0) {
        click.age += dt * 0.01667;
        if (click.age > 1.45) click.age = -1;
      }
      const offset = index * 4;
      state.clicksUniform[offset] = click.x;
      state.clicksUniform[offset + 1] = click.y;
      state.clicksUniform[offset + 2] = Math.max(click.age, 0);
      state.clicksUniform[offset + 3] = click.age >= 0 ? 1 : 0;
    });

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.pointer, state.pointerX, state.pointerY);
    gl.uniform3fv(uniforms.trail, state.trailUniform);
    gl.uniform4fv(uniforms.clicks, state.clicksUniform);
    gl.uniform1f(uniforms.time, now * 0.001);
    gl.uniform1f(uniforms.velocity, reduced ? 0 : state.velocity);
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

  panel.addEventListener("pointerleave", () => {
    state.trailConnected = false;
  }, { passive: true });

  panel.addEventListener("touchmove", event => {
    if (prefersReducedMotion.matches || !event.touches.length) return;
    const touch = event.touches[0];
    setPointer(touch.clientX, touch.clientY, false);
    start();
  }, { passive: true });

  panel.addEventListener("touchend", () => {
    state.trailConnected = false;
  }, { passive: true });

  panel.addEventListener("touchcancel", () => {
    state.trailConnected = false;
  }, { passive: true });

  prefersReducedMotion.addEventListener?.("change", () => {
    state.velocity = 0;
    state.trail.forEach(point => {
      point.strength = 0;
    });
    state.clicks.forEach(click => {
      click.age = -1;
    });
    start();
  });

  window.addEventListener("resize", () => {
    resize();
    start();
  }, { passive: true });

  resize();
  render(performance.now());
})();
