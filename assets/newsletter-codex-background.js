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
    uniform sampler2D u_field;
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
      vec4 fieldSample = texture2D(u_field, uv);
      vec2 fieldVelocity = fieldSample.rg * 2.0 - 1.0;
      float fieldEnergy = fieldSample.b;

      float dist = length(p - pointer);
      float velocity = clamp(u_velocity, 0.0, 1.0);
      float active = 1.0 - u_reduced;

      vec2 toPointer = p - pointer;
      vec2 swirl = vec2(-toPointer.y, toPointer.x) * exp(-dist * 3.4);
      float drag = (0.018 + velocity * 0.09) * active;
      vec2 warped = p + swirl * drag + fieldVelocity * fieldEnergy * 0.032 * active;

      float time = u_time * active;
      float fieldA = fbm(warped * 1.55 + vec2(time * 0.025, -time * 0.018));
      float fieldB = fbm(warped * 3.0 - vec2(time * 0.018, time * 0.026));
      float flow = fieldA * 0.7 + fieldB * 0.3;

      vec2 dotCell = fract(gl_FragCoord.xy / 9.0) - 0.5;
      float fieldSpeed = length(fieldVelocity);
      vec2 fieldDirection = fieldSpeed > 0.015
        ? fieldVelocity / fieldSpeed
        : vec2(1.0, 0.0);
      vec2 fieldNormal = vec2(-fieldDirection.y, fieldDirection.x);
      float along = dot(dotCell, fieldDirection);
      float across = dot(dotCell, fieldNormal);
      float glyphLength = 0.105 + smoothstep(0.04, 0.72, fieldSpeed) * 0.19;
      float glyphWidth = 0.055 + smoothstep(0.0, 0.5, fieldEnergy) * 0.018;
      float ellipseDistance = (along * along) / (glyphLength * glyphLength)
        + (across * across) / (glyphWidth * glyphWidth);
      float dash = 1.0 - smoothstep(0.72, 1.34, ellipseDistance);
      float ringDistance = abs(length(dotCell) - 0.105);
      float ring = 1.0 - smoothstep(0.024, 0.055, ringDistance);
      float chevronDistance = abs(abs(across) - (glyphLength - along) * 0.27);
      float chevronBounds = step(-glyphLength, along) * step(along, glyphLength);
      float chevron = (1.0 - smoothstep(0.018, 0.052, chevronDistance)) * chevronBounds;
      float flowMix = smoothstep(0.045, 0.35, fieldSpeed);
      float glyph = mix(ring, dash, flowMix);
      glyph = max(glyph, chevron * smoothstep(0.22, 0.58, fieldSpeed));
      float dotField = glyph * smoothstep(0.018, 0.24, fieldEnergy)
        * (0.28 + fieldEnergy * 0.8) * active;
      float cursorGlow = fieldEnergy * active;

      float vignette = smoothstep(0.98, 0.18, length((uv - 0.5) * vec2(1.15, 1.0)));
      float depth = smoothstep(-0.7, 0.72, warped.x - warped.y * 0.32);
      vec3 color = palette(flow + cursorGlow * 0.1);

      color += vec3(0.12, 0.42, 0.62) * cursorGlow * 0.12;
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
    field: gl.getUniformLocation(program, "u_field"),
    time: gl.getUniformLocation(program, "u_time"),
    velocity: gl.getUniformLocation(program, "u_velocity"),
    reduced: gl.getUniformLocation(program, "u_reduced"),
  };

  const fieldTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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
    clicks: [],
    fieldWidth: 0,
    fieldHeight: 0,
    fieldEnergy: null,
    fieldVelocityX: null,
    fieldVelocityY: null,
    nextEnergy: null,
    nextVelocityX: null,
    nextVelocityY: null,
    fieldPixels: null,
  };

  function resizeField(rect) {
    const width = Math.max(96, Math.min(160, Math.round(rect.width / 8)));
    const height = Math.max(32, Math.round(width * rect.height / Math.max(rect.width, 1)));
    if (width === state.fieldWidth && height === state.fieldHeight) return;

    const size = width * height;
    state.fieldWidth = width;
    state.fieldHeight = height;
    state.fieldEnergy = new Float32Array(size);
    state.fieldVelocityX = new Float32Array(size);
    state.fieldVelocityY = new Float32Array(size);
    state.nextEnergy = new Float32Array(size);
    state.nextVelocityX = new Float32Array(size);
    state.nextVelocityY = new Float32Array(size);
    state.fieldPixels = new Uint8Array(size * 4);

    gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      state.fieldPixels
    );
  }

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

    resizeField(rect);
  }

  function injectField(x, y, directionX, directionY, amount = 0.45, radius = 2.7) {
    if (!state.fieldEnergy) return;

    const centerX = x * (state.fieldWidth - 1);
    const centerY = y * (state.fieldHeight - 1);
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(state.fieldWidth - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(state.fieldHeight - 1, Math.ceil(centerY + radius));
    const directionLength = Math.hypot(directionX, directionY);
    const normalizedX = directionLength > 0.001 ? directionX / directionLength : 0;
    const normalizedY = directionLength > 0.001 ? directionY / directionLength : 0;

    for (let fieldY = minY; fieldY <= maxY; fieldY += 1) {
      for (let fieldX = minX; fieldX <= maxX; fieldX += 1) {
        const offsetX = fieldX - centerX;
        const offsetY = fieldY - centerY;
        const distanceSquared = offsetX * offsetX + offsetY * offsetY;
        if (distanceSquared > radius * radius) continue;

        const weight = Math.exp(-distanceSquared / (radius * radius) * 2.8);
        const index = fieldY * state.fieldWidth + fieldX;
        state.fieldEnergy[index] += amount * weight;
        state.fieldVelocityX[index] += normalizedX * amount * weight * 0.72;
        state.fieldVelocityY[index] += normalizedY * amount * weight * 0.72;
      }
    }
  }

  function simulateField(frameScale, elapsedSeconds) {
    if (!state.fieldEnergy) return;

    const width = state.fieldWidth;
    const height = state.fieldHeight;
    const energyDecay = Math.pow(0.984, frameScale);
    const velocityDecay = Math.pow(0.95, frameScale);
    const energyBlend = Math.min(0.12 * frameScale, 0.36);
    const velocityBlend = Math.min(0.16 * frameScale, 0.42);

    for (let fieldY = 0; fieldY < height; fieldY += 1) {
      const upY = Math.min(height - 1, fieldY + 1);
      const downY = Math.max(0, fieldY - 1);

      for (let fieldX = 0; fieldX < width; fieldX += 1) {
        const leftX = Math.max(0, fieldX - 1);
        const rightX = Math.min(width - 1, fieldX + 1);
        const index = fieldY * width + fieldX;
        const left = fieldY * width + leftX;
        const right = fieldY * width + rightX;
        const up = upY * width + fieldX;
        const down = downY * width + fieldX;
        const averageEnergy = (
          state.fieldEnergy[left]
          + state.fieldEnergy[right]
          + state.fieldEnergy[up]
          + state.fieldEnergy[down]
        ) * 0.25;
        const averageVelocityX = (
          state.fieldVelocityX[left]
          + state.fieldVelocityX[right]
          + state.fieldVelocityX[up]
          + state.fieldVelocityX[down]
        ) * 0.25;
        const averageVelocityY = (
          state.fieldVelocityY[left]
          + state.fieldVelocityY[right]
          + state.fieldVelocityY[up]
          + state.fieldVelocityY[down]
        ) * 0.25;

        state.nextEnergy[index] = (
          state.fieldEnergy[index]
          + (averageEnergy - state.fieldEnergy[index]) * energyBlend
        ) * energyDecay;
        state.nextVelocityX[index] = (
          state.fieldVelocityX[index]
          + (averageVelocityX - state.fieldVelocityX[index]) * velocityBlend
        ) * velocityDecay;
        state.nextVelocityY[index] = (
          state.fieldVelocityY[index]
          + (averageVelocityY - state.fieldVelocityY[index]) * velocityBlend
        ) * velocityDecay;
      }
    }

    [state.fieldEnergy, state.nextEnergy] = [state.nextEnergy, state.fieldEnergy];
    [state.fieldVelocityX, state.nextVelocityX] = [state.nextVelocityX, state.fieldVelocityX];
    [state.fieldVelocityY, state.nextVelocityY] = [state.nextVelocityY, state.fieldVelocityY];

    state.clicks.forEach(click => {
      click.age += elapsedSeconds;
      const centerX = click.x * (width - 1);
      const centerY = click.y * (height - 1);
      const radius = click.age * 23;
      const thickness = 3.8 + click.age * 1.55;
      const life = Math.max(0, 1 - click.age / 4.6);

      for (let fieldY = 0; fieldY < height; fieldY += 1) {
        for (let fieldX = 0; fieldX < width; fieldX += 1) {
          const offsetX = fieldX - centerX;
          const offsetY = fieldY - centerY;
          const distance = Math.hypot(offsetX, offsetY);
          const ringOffset = (distance - radius) / thickness;
          const ring = Math.exp(-ringOffset * ringOffset * 2.2) * life;
          const wake = distance < radius
            ? Math.exp(-(radius - distance) / Math.max(radius * 0.62, 1)) * life
            : 0;
          const index = fieldY * width + fieldX;
          const outwardX = distance > 0.001 ? offsetX / distance : 0;
          const outwardY = distance > 0.001 ? offsetY / distance : 0;

          state.fieldEnergy[index] += (ring * 0.036 + wake * 0.0045) * frameScale;
          state.fieldVelocityX[index] += outwardX * ring * 0.014 * frameScale;
          state.fieldVelocityY[index] += outwardY * ring * 0.014 * frameScale;
        }
      }
    });
    state.clicks = state.clicks.filter(click => click.age < 4.6);

    for (let index = 0; index < state.fieldEnergy.length; index += 1) {
      const pixelOffset = index * 4;
      const encodedVelocityX = Math.tanh(state.fieldVelocityX[index] * 0.82);
      const encodedVelocityY = Math.tanh(state.fieldVelocityY[index] * 0.82);
      const encodedEnergy = 1 - Math.exp(-state.fieldEnergy[index] * 0.72);
      state.fieldPixels[pixelOffset] = Math.round((encodedVelocityX * 0.5 + 0.5) * 255);
      state.fieldPixels[pixelOffset + 1] = Math.round((encodedVelocityY * 0.5 + 0.5) * 255);
      state.fieldPixels[pixelOffset + 2] = Math.round(encodedEnergy * 255);
      state.fieldPixels[pixelOffset + 3] = 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      state.fieldPixels
    );
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
      injectField(state.targetX, state.targetY, 0, 0, 0.5);
      state.trailConnected = true;
      state.lastTrailX = state.targetX;
      state.lastTrailY = state.targetY;
    } else {
      const fromX = state.lastTrailX;
      const fromY = state.lastTrailY;
      const movementX = (state.targetX - fromX) * rect.width;
      const movementY = (state.targetY - fromY) * rect.height;
      const movementDistance = Math.hypot(movementX, movementY);
      const segmentCount = Math.max(1, Math.ceil(movementDistance / 6));
      const trailAmount = 0.32 + speed * 0.42;

      for (let index = 1; index <= segmentCount; index += 1) {
        const progress = index / segmentCount;
        injectField(
          fromX + (state.targetX - fromX) * progress,
          fromY + (state.targetY - fromY) * progress,
          movementX,
          movementY,
          trailAmount
        );
      }
      state.lastTrailX = state.targetX;
      state.lastTrailY = state.targetY;
    }

    if (shouldPulse) {
      state.clicks.push({ x: state.targetX, y: state.targetY, age: 0 });
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
    simulateField(dt, dt * 0.01667);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.pointer, state.pointerX, state.pointerY);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
    gl.uniform1i(uniforms.field, 0);
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
    state.fieldEnergy?.fill(0);
    state.fieldVelocityX?.fill(0);
    state.fieldVelocityY?.fill(0);
    state.clicks = [];
    start();
  });

  window.addEventListener("resize", () => {
    resize();
    start();
  }, { passive: true });

  resize();
  render(performance.now());
})();
