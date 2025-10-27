import { WebGLManager } from "../engine/WebGLManager";
import * as shaders from "../shaders/shaders";
import { Pointer } from "../utils/Pointer";
// import canonical defaults so missing keys are filled
import { config as defaultConfig } from "../config/simulationConfig";

export class FluidSimulation {
  constructor(canvas, config) {
    this.canvas = canvas;
    // Track which config keys were explicitly provided by the user so presets don't override them.
    this._explicitConfigKeys = new Set(Object.keys(config || {}));
    // Merge provided config over canonical defaults so the pipeline always sees a full set of options.
    this.config = { ...(defaultConfig || {}), ...(config || {}) };

    // Keep a persistent base splat radius (user-provided or default) so we can scale it on resize.
    this._baseSplatRadius = Number(this.config.SPLAT_RADIUS) || 0.01;

    // Apply initial quality preset if provided in config (may overwrite some user keys)
    if (this.config.QUALITY) {
      this.applyQualityPreset(this.config.QUALITY);
    }

    this.manager = new WebGLManager(canvas, this.config);
    if (!this.manager.webGL) {
      throw new Error("WebGL not supported");
    }

    this.pointers = [new Pointer()];
    this.splatStack = [];

    this.animationFrameId = null;
    this.lastUpdateTime = Date.now();

    this.dye = null;
    this.velocity = null;
    this.divergence = null;
    this.curl = null;
    this.pressure = null;
    this.aura = null;
    this.auraTemp = null; // Temporary FBO for multi-pass blur
    this.auraMask = null;
    this.rayAura = null;
    this.rayAuraMask = null;

    this._initPrograms();
    this.initFramebuffers();

    // Validate runtime config to catch accidental dev flags or extreme values before publish.
    this._validateConfig();

    // Detect iOS devices so we can prefer manual filter there when appropriate
    const ua =
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "";
    // Modern iPadOS can present a "Macintosh" UA; detect by platform + touch support as well.
    const hasTouchPoints =
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 0;
    this._isIOS =
      (/iPad|iPhone|iPod/.test(ua) ||
        (navigator && navigator.platform === "MacIntel" && hasTouchPoints) ||
        (ua.includes("Macintosh") && hasTouchPoints)) &&
      !window.MSStream;

    // runtime helpers bound to instance (optional convenience)
    this.setIOSDprCap = (v) => this.setIOSDPRCap(v);
    this.enableIOSBicubic = (v) => this.setEnableIOSBicubic(!!v);

    // Expose dev-only helpers when running in non-production builds so developers
    // can toggle simulation paths at runtime without shipping a change.
    const __DEV__ =
      typeof process !== "undefined" &&
      process.env &&
      process.env.NODE_ENV !== "production";
    if (__DEV__) {
      // Allow toggling the simulated "no float-linear" path in dev builds:
      this.simulateNoFloatLinear = (v) => this.enableSimulateNoFloatLinear(!!v);
    }

    // Debug overlay state
    this.debugOverlay = null;
    this._lastOverlayUpdate = 0;
    this._maybeCreateDebugOverlay();

    // Log diagnostics
    try {
      // Intentionally keep console.debug-level logging out of production startup.
      // Use the debug overlay (if enabled) or inspect getDiagnostics() manually.
    } catch (_e) {
      /* ignore */
    }
  }
  // iOS helpers
  setIOSDPRCap(cap) {
    this.config.IOS_DPR_CAP = cap == null ? null : Number(cap);
    if (this._resizeChecker()) this.initFramebuffers();
  }

  enableSimulateNoFloatLinear(enable) {
    this.config.IOS_SIMULATE_NO_FLOAT_LINEAR = !!enable;
  }

  setEnableIOSBicubic(enable) {
    this.config.IOS_ENABLE_BICUBIC_ON_IOS = !!enable;
  }

  // Debug overlay helpers (create/destroy/update)
  _maybeCreateDebugOverlay() {
    if (this.config.DEBUG_OVERLAY && !this.debugOverlay)
      this.createDebugOverlay();
    if (!this.config.DEBUG_OVERLAY && this.debugOverlay)
      this.destroyDebugOverlay();
  }

  createDebugOverlay() {
    if (this.debugOverlay) return;
    const parent = this.canvas.parentElement || document.body;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.top = "10px";
    el.style.left = "10px";
    el.style.zIndex = 9999;
    el.style.pointerEvents = "none";
    el.style.background = "rgba(0,0,0,0.5)";
    el.style.color = "white";
    el.style.fontFamily = "monospace";
    el.style.fontSize = "12px";
    el.style.padding = "6px";
    el.style.whiteSpace = "pre";
    el.textContent = "debug overlay";
    parent.appendChild(el);
    this.debugOverlay = el;
    this.updateDebugOverlay(true);
  }

  destroyDebugOverlay() {
    if (!this.debugOverlay) return;
    if (this.debugOverlay.parentElement)
      this.debugOverlay.parentElement.removeChild(this.debugOverlay);
    this.debugOverlay = null;
  }

  updateDebugOverlay(force = false) {
    if (!this.debugOverlay) return;
    const now = performance.now();
    if (!force && now - this._lastOverlayUpdate < 200) return; // throttle ~5Hz
    this._lastOverlayUpdate = now;
    const d = this.getDiagnostics();
    const ua =
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "(no-UA)";
    const touchPoints =
      typeof navigator !== "undefined" && navigator.maxTouchPoints
        ? navigator.maxTouchPoints
        : 0;
    // compute actual upscaling if possible
    const gl = this.manager && this.manager.webGL ? this.manager.webGL : null;
    const drawW = gl
      ? gl.drawingBufferWidth
      : this.canvas
      ? this.canvas.width
      : 0;
    const drawH = gl
      ? gl.drawingBufferHeight
      : this.canvas
      ? this.canvas.height
      : 0;
    const dyeW = this.dye ? this.dye.width : 0;
    const dyeH = this.dye ? this.dye.height : 0;
    const upscaleX = dyeW ? drawW / dyeW : 1.0;
    const upscaleY = dyeH ? drawH / dyeH : 1.0;
    const lines = [
      `UA: ${ua}`,
      `touchPoints: ${touchPoints}`,
      `isIOS: ${d.isIOS}`,
      `manualFilter: ${d.manualFilterActive} (cfg:${d.userIOSFilterConfig})`,
      `float-linear: ${d.supportLinearFiltering}`,
      `DISPLAY_TO_RGBA8: ${d.displayToRGBA8}`,
      `Bicubic: ${d.displayUseBicubic} (iosEnable:${d.iosEnableBicubicOnIOS})`,
      `canvas: ${d.canvasWidth}x${d.canvasHeight}  backbuffer: ${d.drawingBufferWidth}x${d.drawingBufferHeight}`,
      `SIM/DYE (cfg): ${d.SIM_RESOLUTION}/${d.DYE_RESOLUTION}`,
      `Dye buffer: ${dyeW}x${dyeH}  Upscale: x${upscaleX.toFixed(
        2
      )},x${upscaleY.toFixed(2)}`,
      `CURL: ${d.CURL}  BRIGHT: ${d.BRIGHTNESS}`,
      `QUALITY: ${d.QUALITY}`,
    ];
    this.debugOverlay.textContent = lines.join("\n");
  }

  // Runtime control helpers for the manual bilinear filter (uManualFilter).
  setManualFilter(value) {
    this.config.IOS_FILTER = value === undefined ? null : !!value;
  }

  enableManualFilter() {
    this.config.IOS_FILTER = true;
  }

  disableManualFilter() {
    this.config.IOS_FILTER = false;
  }

  toggleManualFilter() {
    const cur = this.config.IOS_FILTER;
    if (cur === null || cur === undefined) this.config.IOS_FILTER = true;
    else if (cur === true) this.config.IOS_FILTER = false;
    else this.config.IOS_FILTER = null;
  }

  getManualFilterState() {
    return this.config.IOS_FILTER === undefined ? null : this.config.IOS_FILTER;
  }

  _initPrograms() {
    this.programs = {
      splat: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.splatShader
      ),
      divergence: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.divergenceShader
      ),
      curl: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.curlShader
      ),
      vorticity: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.vorticityShader
      ),
      pressure: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.pressureShader
      ),
      gradientSubtract: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.gradientSubtractShader
      ),
      auraMask: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.sunraysMaskShader
      ),
      aura: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.blurShader
      ),
      rayAuraMask: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.sunraysMaskShader
      ),
      rayAura: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.rayAuraShader
      ),
      display: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.displayShader
      ),
      copy: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.copyShader
      ),
      sharpen: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.sharpenShader
      ),
      downsample: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.downsampleShader
      ),
      advection: this.manager.createProgram(
        shaders.baseVertexShader,
        shaders.advectionShader
      ),
    };
  }

  // Apply a named quality preset ("low" | "medium" | "high" | "ultra").
  // Previously only set config keys when undefined; this change allows presets to increase
  // resolution/iterations/curl (so "high" actually increases dye resolution) while keeping
  // existing explicit higher user values intact. SPLAT_RADIUS prefers the smaller (finer) value.
  applyQualityPreset(preset) {
    const P = String(preset || "").toLowerCase();
    const presets = {
      low: {
        SIM_RESOLUTION: 64,
        DYE_RESOLUTION: 512,
        PRESSURE_ITERATIONS: 8,
        CURL: 0.5,
        SPLAT_RADIUS: 0.004,
      },
      medium: {
        SIM_RESOLUTION: 128,
        DYE_RESOLUTION: 1024,
        PRESSURE_ITERATIONS: 20,
        CURL: 2.0,
        SPLAT_RADIUS: 0.0025,
      },
      high: {
        SIM_RESOLUTION: 256,
        DYE_RESOLUTION: 2048,
        PRESSURE_ITERATIONS: 32,
        CURL: 6.0,
        SPLAT_RADIUS: 0.0018,
      },
      ultra: {
        SIM_RESOLUTION: 256,
        DYE_RESOLUTION: 4096,
        PRESSURE_ITERATIONS: 48,
        CURL: 10.0,
        SPLAT_RADIUS: 0.0012,
      },
    };

    const chosen = presets[P] || presets.medium;

    // For parameters where higher values improve quality, adopt the preset if it increases the current value.
    // However, if the user explicitly provided SIM_RESOLUTION or DYE_RESOLUTION, respect their choice.
    const increaseKeys = [
      "SIM_RESOLUTION",
      "DYE_RESOLUTION",
      "PRESSURE_ITERATIONS",
      "CURL",
    ];
    for (const key of increaseKeys) {
      // Respect explicit user choice for SIM/DYE
      if (
        (key === "SIM_RESOLUTION" || key === "DYE_RESOLUTION") &&
        this._explicitConfigKeys.has(key)
      ) {
        // skip preset-driven increase for values the user explicitly set
        continue;
      }
      const cur = Number(this.config[key] || 0);
      const want = Number(chosen[key] || 0);
      if (this.config[key] === undefined || want > cur) {
        this.config[key] = want;
      }
    }

    // For splat radius prefer the smaller (finer) value for higher quality
    if (this.config.SPLAT_RADIUS === undefined) {
      this.config.SPLAT_RADIUS = chosen.SPLAT_RADIUS;
    } else {
      const curRadius = Number(this.config.SPLAT_RADIUS);
      const presetRadius = Number(chosen.SPLAT_RADIUS);
      if (presetRadius < curRadius) this.config.SPLAT_RADIUS = presetRadius;
    }

    this.config.QUALITY = P || "medium";
  }

  initFramebuffers() {
    const { webGL, ext: webGLExt } = this.manager;
    const simWidth = this.config.SIM_RESOLUTION;
    const simHeight = this.config.SIM_RESOLUTION;
    const dyeRes = this.config.DYE_RESOLUTION;
    // If AUTO_DYE_RESOLUTION is enabled, prefer a dye size based on canvas backing (but don't exceed configured maximum)
    // Use canvas.width (backing pixels) when available; otherwise fall back to configured dyeRes.
    const backingW =
      this.canvas && this.canvas.width ? this.canvas.width : null;
    const backingH =
      this.canvas && this.canvas.height ? this.canvas.height : null;
    let dyeWidth =
      this.config.AUTO_DYE_RESOLUTION && backingW
        ? Math.max(128, Math.min(dyeRes, backingW))
        : dyeRes;
    let dyeHeight =
      this.config.AUTO_DYE_RESOLUTION && backingH
        ? Math.max(128, Math.min(dyeRes, backingH))
        : dyeRes;

    // Avoid extremely large upscaling (e.g. dye 128 -> display 2160 => blocky pixels).
    // If the computed dye size would be upscaled beyond MAX_DYE_UPSCALE, increase the dye size
    // (up to the configured DYE_RESOLUTION) so final upscale <= MAX_DYE_UPSCALE.
    // Default cap if not provided: 3.0
    const maxUpscale = Number(this.config.MAX_DYE_UPSCALE || 3.0);
    // Prefer using the actual drawing buffer size if available
    const drawW =
      webGL && webGL.drawingBufferWidth
        ? webGL.drawingBufferWidth
        : this.canvas
        ? this.canvas.width
        : null;
    const drawH =
      webGL && webGL.drawingBufferHeight
        ? webGL.drawingBufferHeight
        : this.canvas
        ? this.canvas.height
        : null;
    if (drawW && dyeWidth) {
      const upscaleX = drawW / Math.max(1, dyeWidth);
      if (upscaleX > maxUpscale) {
        // Target dye width so drawW / target <= maxUpscale -> target >= drawW / maxUpscale
        const targetW = Math.min(
          dyeRes,
          Math.max(128, Math.floor(drawW / maxUpscale))
        );
        dyeWidth = targetW;
      }
    }
    if (drawH && dyeHeight) {
      const upscaleY = drawH / Math.max(1, dyeHeight);
      if (upscaleY > maxUpscale) {
        const targetH = Math.min(
          dyeRes,
          Math.max(128, Math.floor(drawH / maxUpscale))
        );
        dyeHeight = targetH;
      }
    }

    this.textureWidth = simWidth;
    this.textureHeight = simHeight;

    const texType = webGLExt.halfFloatTexType;
    const rgba = webGLExt.formatRGBA;
    const rg = webGLExt.formatRG;
    const r = webGLExt.formatR;
    const filtering = webGLExt.supportLinearFiltering
      ? webGL.LINEAR
      : webGL.NEAREST;

    if (
      this.dye == null ||
      this.dye.width !== dyeWidth ||
      this.dye.height !== dyeHeight
    ) {
      this.dye = this.manager.createDoubleFBO(
        dyeWidth,
        dyeHeight,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering
      );
    }

    // DISPLAY_TO_RGBA8 intermediate
    if (this.config.DISPLAY_TO_RGBA8) {
      const displayInternal = webGL.RGBA8 ? webGL.RGBA8 : webGL.RGBA;
      const displayFormat = webGL.RGBA;
      const displayType = webGL.UNSIGNED_BYTE;
      const displayWidth =
        webGL && webGL.drawingBufferWidth ? webGL.drawingBufferWidth : dyeWidth;
      const displayHeight =
        webGL && webGL.drawingBufferHeight
          ? webGL.drawingBufferHeight
          : dyeHeight;
      if (
        !this.display8 ||
        this.display8.width !== displayWidth ||
        this.display8.height !== displayHeight
      ) {
        this.display8 = this.manager.createFBO(
          displayWidth,
          displayHeight,
          displayInternal,
          displayFormat,
          displayType,
          webGL.LINEAR
        );
      }
      // Create an 8-bit copy of the dye (same size as display) used when HW float-linear is unavailable.
      // This is the buffer we downsample the half-float dye into, then the display shader reads from it.
      if (
        !this.dye8 ||
        this.dye8.width !== displayWidth ||
        this.dye8.height !== displayHeight
      ) {
        this.dye8 = this.manager.createFBO(
          displayWidth,
          displayHeight,
          displayInternal,
          displayFormat,
          displayType,
          webGL.LINEAR
        );
      }
    } else {
      this.display8 = null;
      this.dye8 = null;
    }

    this.velocity = this.manager.createDoubleFBO(
      this.textureWidth,
      this.textureHeight,
      rg.internalFormat,
      rg.format,
      texType,
      filtering
    );
    this.divergence = this.manager.createFBO(
      this.textureWidth,
      this.textureHeight,
      r.internalFormat,
      r.format,
      texType,
      webGL.NEAREST
    );
    this.curl = this.manager.createFBO(
      this.textureWidth,
      this.textureHeight,
      r.internalFormat,
      r.format,
      texType,
      webGL.NEAREST
    );
    this.pressure = this.manager.createDoubleFBO(
      this.textureWidth,
      this.textureHeight,
      r.internalFormat,
      r.format,
      texType,
      webGL.NEAREST
    );

    this.initAuraFramebuffers();
    this.initRayAuraFramebuffers();
  }

  _calcDeltaTime() {
    const now = Date.now();
    let dt = (now - this.lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    this.lastUpdateTime = now;
    return dt;
  }

  _resizeChecker() {
    const cssWidth = this.canvas.clientWidth;
    const cssHeight = this.canvas.clientHeight;
    const globalDpr = window.devicePixelRatio || 1;
    const cap =
      this._isIOS && this.config.IOS_DPR_CAP != null
        ? this.config.IOS_DPR_CAP
        : 2;
    const dpr = Math.min(globalDpr, cap);
    const newWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const newHeight = Math.max(1, Math.floor(cssHeight * dpr));

    if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
      this.canvas.style.width = cssWidth + "px";
      this.canvas.style.height = cssHeight + "px";
      return true;
    }
    return false;
  }

  splat(x, y, dx, dy, color) {
    const { webGL, blit } = this.manager;
    const splatProgram = this.programs.splat;

    // const resolutionScale = 128.0 / Math.max(1, this.textureWidth);

    // Use backing-store (pixel) aspect like Pavel: keep splats circular in screen pixels.
    const backingAspect =
      this.canvas.width && this.canvas.height
        ? this.canvas.width / Math.max(1, this.canvas.height)
        : 1.0;

    // Splat velocity (target = velocity FBO).
    webGL.viewport(0, 0, this.velocity.width, this.velocity.height);
    splatProgram.bind();
    webGL.uniform1i(
      splatProgram.uniforms.uTarget,
      this.velocity.read.attach(0)
    );
    webGL.uniform1f(splatProgram.uniforms.aspectRatio, backingAspect);
    webGL.uniform2f(splatProgram.uniforms.point, x, y);
    webGL.uniform3f(splatProgram.uniforms.color, dx, dy, 1.0);
    webGL.uniform1f(splatProgram.uniforms.brightness, 1.0); // Full brightness for velocity
    webGL.uniform1f(
      splatProgram.uniforms.radius,
      this.config.SPLAT_RADIUS / 5.0
    );
    blit(this.velocity.write.fbo);
    this.velocity.swap();

    // Splat dye
    webGL.viewport(0, 0, this.dye.width, this.dye.height);
    splatProgram.bind();
    webGL.uniform1i(splatProgram.uniforms.uTarget, this.dye.read.attach(0));
    // use same backing-store aspect so dye splat matches velocity splat appearance on screen
    webGL.uniform1f(splatProgram.uniforms.aspectRatio, backingAspect);
    webGL.uniform2f(splatProgram.uniforms.point, x, y);
    webGL.uniform1f(
      splatProgram.uniforms.brightness,
      this.config.AURA ? 0.6 : 1.0
    ); // Slightly increased brightness for dye when aura is active
    webGL.uniform1f(splatProgram.uniforms.radius, this.config.SPLAT_RADIUS);
    webGL.uniform3f(splatProgram.uniforms.color, color[0], color[1], color[2]);
    blit(this.dye.write.fbo);
    this.dye.swap();
  }

  addSplat(pointer) {
    this.splatStack.push(pointer);
  }

  _updateSplats() {
    this.splatStack.forEach((pointer) => {
      this.splat(
        pointer.texcoordX,
        pointer.texcoordY,
        pointer.deltaX,
        pointer.deltaY,
        pointer.color
      );
    });
    this.splatStack = [];
  }

  initAuraFramebuffers() {
    const { webGL, ext: webGLExt } = this.manager;
    const res = this.config.AURA_RESOLUTION;
    const texType = webGLExt.halfFloatTexType;
    const rgba = webGLExt.formatRGBA;
    const filtering = webGL.LINEAR;

    this.aura = this.manager.createFBO(
      res,
      res,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );
    this.auraTemp = this.manager.createFBO(
      res,
      res,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );
    this.auraMask = this.manager.createFBO(
      res,
      res,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );
  }

  _applyAura(source, mask, destination) {
    const { webGL, blit } = this.manager;
    const { auraMask: maskProgram, aura: blurProgram } = this.programs;

    maskProgram.bind();
    webGL.uniform1i(maskProgram.uniforms.uTexture, source.read.attach(0));
    webGL.viewport(0, 0, mask.width, mask.height);
    blit(mask.fbo);

    blurProgram.bind();
    webGL.uniform1f(blurProgram.uniforms.weight, this.config.AURA_WEIGHT);
    webGL.uniform2f(blurProgram.uniforms.texelSize, 1.0 / mask.width, 0.0);
    webGL.uniform1i(blurProgram.uniforms.uTexture, mask.attach(0));
    blit(this.auraTemp.fbo);

    webGL.uniform2f(blurProgram.uniforms.texelSize, 0.0, 1.0 / mask.height);
    webGL.uniform1i(blurProgram.uniforms.uTexture, this.auraTemp.attach(0));
    blit(destination.fbo);
  }

  initRayAuraFramebuffers() {
    const { webGL, ext: webGLExt } = this.manager;
    const res = this.config.RAY_AURA_RESOLUTION;
    const texType = webGLExt.halfFloatTexType;
    const rgba = webGLExt.formatRGBA;
    const filtering = webGL.LINEAR;

    this.rayAura = this.manager.createFBO(
      res,
      res,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );
    this.rayAuraMask = this.manager.createFBO(
      res,
      res,
      rgba.internalFormat,
      rgba.format,
      texType,
      filtering
    );
  }

  _applyRayAura(source, mask, destination) {
    const { webGL, blit } = this.manager;
    const { rayAuraMask: maskProgram, rayAura: auraProgram } = this.programs;

    // Save/restore BLEND state and use the correct GL reference (webGL).
    const prevBlend = webGL.isEnabled ? webGL.isEnabled(webGL.BLEND) : true;
    webGL.disable(webGL.BLEND);

    maskProgram.bind();
    if (maskProgram.uniforms && maskProgram.uniforms.uTexture) {
      webGL.uniform1i(maskProgram.uniforms.uTexture, source.read.attach(0));
    }
    webGL.viewport(0, 0, mask.width, mask.height);
    blit(mask.fbo);

    auraProgram.bind();
    if (auraProgram.uniforms && auraProgram.uniforms.weight) {
      webGL.uniform1f(
        auraProgram.uniforms.weight,
        Number(this.config.RAY_AURA_WEIGHT) || 0.5
      );
    }
    if (auraProgram.uniforms && auraProgram.uniforms.uTexture) {
      webGL.uniform1i(auraProgram.uniforms.uTexture, mask.attach(0));
    }
    webGL.viewport(0, 0, destination.width, destination.height);
    blit(destination.fbo);

    // restore BLEND state if possible
    try {
      if (typeof webGL.enable === "function" && prevBlend)
        webGL.enable(webGL.BLEND);
    } catch (_e) {
      /* ignore restore errors */
    }
  }

  _getManualFilterFlag() {
    if (this.config.IOS_FILTER === true) {
      return 1;
    }
    if (this.config.IOS_FILTER === false) {
      return 0;
    }
    // auto: use manual only when HW float-linear is NOT supported (or simulated)
    const hwSupportsLinear = !!(this.manager.ext && this.manager.ext.supportLinearFiltering);
    const simulateNoFloat = !!this.config.IOS_SIMULATE_NO_FLOAT_LINEAR;
    const effectiveSupportsLinear = simulateNoFloat ? false : hwSupportsLinear;
    return effectiveSupportsLinear ? 0 : 1;
  }

  _getUseBicubicFlag(manualFilterFlag) {
    const { webGL } = this.manager;
    const drawW = webGL.drawingBufferWidth || (this.canvas && this.canvas.width) || 1;
    const drawH = webGL.drawingBufferHeight || (this.canvas && this.canvas.height) || 1;
    const upscaleX = drawW / Math.max(1, this.dye.width);
    const upscaleY = drawH / Math.max(1, this.dye.height);
    const isUpscaling = upscaleX > 1.01 || upscaleY > 1.01;

    const bicubicGlobal = !!this.config.DISPLAY_USE_BICUBIC;
    const bicubicOnIOS = !!this.config.IOS_ENABLE_BICUBIC_ON_IOS;
    const upscaleOnly = !!this.config.DISPLAY_USE_BICUBIC_UPSCALE_ONLY;
    const bicubicAllowed = bicubicGlobal || (this._isIOS && bicubicOnIOS);

    return manualFilterFlag && bicubicAllowed && (!upscaleOnly || isUpscaling);
  }

  _setSharedDisplayUniforms(program, manualFilterFlag, useBicubic) {
    const { webGL } = this.manager;
    if (program.uniforms.uManualFilter) webGL.uniform1i(program.uniforms.uManualFilter, manualFilterFlag);
    if (program.uniforms.uUseBicubic) webGL.uniform1i(program.uniforms.uUseBicubic, useBicubic ? 1 : 0);
    if (program.uniforms.uTexture) webGL.uniform1i(program.uniforms.uTexture, this.dye.read.attach(0));
    if (program.uniforms.uAura) webGL.uniform1i(program.uniforms.uAura, this.aura.attach(1));
    if (program.uniforms.uShadingEnabled) webGL.uniform1i(program.uniforms.uShadingEnabled, this.config.SHADING);
    if (program.uniforms.dyeTexelSize) webGL.uniform2f(program.uniforms.dyeTexelSize, 1.0 / this.dye.width, 1.0 / this.dye.height);
    if (program.uniforms.transparent) webGL.uniform1i(program.uniforms.transparent, this.config.TRANSPARENT);
    if (program.uniforms.uAuraEnabled) webGL.uniform1i(program.uniforms.uAuraEnabled, this.config.AURA);
    if (program.uniforms.uBrightness) webGL.uniform1f(program.uniforms.uBrightness, this.config.BRIGHTNESS);
    if (program.uniforms.uRayAuraEnabled) webGL.uniform1i(program.uniforms.uRayAuraEnabled, this.config.RAY_AURA);
    if (program.uniforms.uRayAura) webGL.uniform1i(program.uniforms.uRayAura, this.rayAura.attach(2));
    if (program.uniforms.backColor) webGL.uniform3f(program.uniforms.backColor, this.config.BACK_COLOR.r / 255.0, this.config.BACK_COLOR.g / 255.0, this.config.BACK_COLOR.b / 255.0);
  }

  _renderTo8BitIntermediate(manualFilterFlag, useBicubic) {
    const { webGL, blit } = this.manager;
    const { display: displayProgram, downsample: downsampleProgram, sharpen: sharpenProgram, copy: copyProgram } = this.programs;

    const needDownsampleTo8 = !this.manager.ext.supportLinearFiltering && this.dye8;

    if (needDownsampleTo8) {
      webGL.viewport(0, 0, this.dye8.width, this.dye8.height);
      downsampleProgram.bind();
      if (downsampleProgram.uniforms.uSource) webGL.uniform1i(downsampleProgram.uniforms.uSource, this.dye.read.attach(0));
      if (downsampleProgram.uniforms.destSize) webGL.uniform2f(downsampleProgram.uniforms.destSize, this.dye8.width, this.dye8.height);
      blit(this.dye8.fbo);
    }

    webGL.viewport(0, 0, this.display8.width, this.display8.height);
    displayProgram.bind();

    if (needDownsampleTo8 && this.dye8) {
      if (displayProgram.uniforms.uManualFilter) webGL.uniform1i(displayProgram.uniforms.uManualFilter, 0);
      if (displayProgram.uniforms.uUseBicubic) webGL.uniform1i(displayProgram.uniforms.uUseBicubic, 0);
      if (displayProgram.uniforms.uTexture) webGL.uniform1i(displayProgram.uniforms.uTexture, this.dye8.attach(0));
      if (displayProgram.uniforms.dyeTexelSize) webGL.uniform2f(displayProgram.uniforms.dyeTexelSize, 1.0 / this.dye8.width, 1.0 / this.dye8.height);
    } else {
      this._setSharedDisplayUniforms(displayProgram, manualFilterFlag, useBicubic);
    }
    blit(this.display8.fbo);

    webGL.viewport(0, 0, webGL.drawingBufferWidth, webGL.drawingBufferHeight);

    const needSharpen = !this.manager.ext.supportLinearFiltering && this.config.IOS_SHARPEN_AMOUNT > 0;
    if (needSharpen) {
      sharpenProgram.bind();
      if (sharpenProgram.uniforms.uTexture) webGL.uniform1i(sharpenProgram.uniforms.uTexture, this.display8.attach(0));
      if (sharpenProgram.uniforms.texelSize) webGL.uniform2f(sharpenProgram.uniforms.texelSize, 1.0 / this.display8.width, 1.0 / this.display8.height);
      if (sharpenProgram.uniforms.amount) webGL.uniform1f(sharpenProgram.uniforms.amount, Number(this.config.IOS_SHARPEN_AMOUNT) || 0.18);
      blit(null);
    } else {
      copyProgram.bind();
      if (copyProgram.uniforms.uTexture) webGL.uniform1i(copyProgram.uniforms.uTexture, this.display8.attach(0));
      blit(null);
    }
  }

  _renderDirectToCanvas(manualFilterFlag, useBicubic) {
    const { webGL, blit } = this.manager;
    const { display: displayProgram } = this.programs;
    webGL.viewport(0, 0, webGL.drawingBufferWidth, webGL.drawingBufferHeight);
    displayProgram.bind();
    this._setSharedDisplayUniforms(displayProgram, manualFilterFlag, useBicubic);
    blit(null);
  }

  _update(dt) {
    const { webGL, blit } = this.manager;
    const {
      curl: curlProgram,
      vorticity: vorticityProgram,
      divergence: divergenceProgram,
      advection: advectionProgram,
      pressure: pressureProgram,
      gradientSubtract: gradientSubtractProgram
    } = this.programs;

    const curlScale = 128.0 / Math.max(1, this.textureWidth);
    const effectiveCurl = (this.config.CURL || 0.0) * curlScale;

    // Decide whether to use manual bilinear filtering (uManualFilter):
    // - If config.IOS_FILTER === true  => force manual filter
    const manualFilterFlag = this._getManualFilterFlag();

    // velocity advection
    webGL.viewport(0, 0, this.textureWidth, this.textureHeight);
    advectionProgram.bind();
    if (advectionProgram.uniforms.uManualFilter)
      webGL.uniform1i(
        advectionProgram.uniforms.uManualFilter,
        manualFilterFlag
      );
    webGL.uniform2f(
      advectionProgram.uniforms.velocityTexelSize,
      1.0 / this.textureWidth,
      1.0 / this.textureHeight
    );
    webGL.uniform1i(
      advectionProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    webGL.uniform1i(
      advectionProgram.uniforms.uSource,
      this.velocity.read.attach(0)
    );
    webGL.uniform1f(advectionProgram.uniforms.dt, dt);
    webGL.uniform1f(
      advectionProgram.uniforms.dissipation,
      this.config.VELOCITY_DISSIPATION
    );
    blit(this.velocity.write.fbo);
    this.velocity.swap();

    curlProgram.bind();
    webGL.uniform2f(
      curlProgram.uniforms.texelSize,
      1.0 / this.textureWidth,
      1.0 / this.textureHeight
    );
    webGL.uniform1i(
      curlProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    blit(this.curl.fbo);

    vorticityProgram.bind();
    webGL.uniform2f(
      vorticityProgram.uniforms.texelSize,
      1.0 / this.textureWidth,
      1.0 / this.textureHeight
    );
    webGL.uniform1i(
      vorticityProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    webGL.uniform1i(vorticityProgram.uniforms.uCurl, this.curl.attach(1));
    webGL.uniform1f(vorticityProgram.uniforms.curl, effectiveCurl);
    webGL.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(this.velocity.write.fbo);

    this.velocity.swap();

    divergenceProgram.bind();
    webGL.uniform2f(
      divergenceProgram.uniforms.texelSize,
      1.0 / this.textureWidth,
      1.0 / this.textureHeight
    );
    webGL.uniform1i(
      divergenceProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    blit(this.divergence.fbo);

    pressureProgram.bind();
    webGL.uniform2f(
      pressureProgram.uniforms.texelSize,
      1.0 / this.textureWidth,
      1.0 / this.textureHeight
    );
    webGL.uniform1i(
      pressureProgram.uniforms.uDivergence,
      this.divergence.attach(0)
    );
    for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
      webGL.uniform1i(
        pressureProgram.uniforms.uPressure,
        this.pressure.read.attach(1)
      );
      blit(this.pressure.write.fbo);
      this.pressure.swap();
    }

    gradientSubtractProgram.bind();
    webGL.uniform2f(
      gradientSubtractProgram.uniforms.texelSize,
      1.0 / this.textureWidth,
      1.0 / this.textureHeight
    );
    webGL.uniform1i(
      gradientSubtractProgram.uniforms.uPressure,
      this.pressure.read.attach(0)
    );
    webGL.uniform1i(
      gradientSubtractProgram.uniforms.uVelocity,
      this.velocity.read.attach(1)
    );
    blit(this.velocity.write.fbo);
    this.velocity.swap();

    webGL.viewport(0, 0, this.dye.width, this.dye.height);
    advectionProgram.bind();
    webGL.uniform2f(
      advectionProgram.uniforms.velocityTexelSize,
      1.0 / this.textureWidth,
      1.0 / this.textureHeight
    );
    webGL.uniform1i(
      advectionProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    webGL.uniform1i(advectionProgram.uniforms.uSource, this.dye.read.attach(1)); // Advect dye through the velocity field
    webGL.uniform1f(advectionProgram.uniforms.dt, dt);
    webGL.uniform1f(
      advectionProgram.uniforms.dissipation,
      this.config.DENSITY_DISSIPATION
    );
    blit(this.dye.write.fbo);
    this.dye.swap();

    // Post-processing
    if (this.config.AURA) {
      this._applyAura(this.dye, this.auraMask, this.aura);
    }

    if (this.config.RAY_AURA) {
      this._applyRayAura(this.dye, this.rayAuraMask, this.rayAura);
    }

    const useBicubic = this._getUseBicubicFlag(manualFilterFlag);

    if (this.config.DISPLAY_TO_RGBA8 && this.display8) {
      this._renderTo8BitIntermediate(manualFilterFlag, useBicubic);
    } else {
      this._renderDirectToCanvas(manualFilterFlag, useBicubic);
    }
  }

  _tick() {
    const dt = this._calcDeltaTime();
    if (this._resizeChecker()) {
      this.initFramebuffers();
    }

    this._updateSplats();
    this._update(dt);
    if (this.config.DEBUG_OVERLAY) this.updateDebugOverlay();
    this.animationFrameId = requestAnimationFrame(() => this._tick());
  }

  run() {
    if (!this.animationFrameId) {
      this._tick();
    }
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  multipleSplats(amount) {
    for (let i = 0; i < amount; i++) {
      const color = [
        Math.random() * 0.3 + 0.1,
        Math.random() * 0.3 + 0.1,
        Math.random() * 0.3 + 0.1,
      ];
      const x = Math.random();
      const y = Math.random();
      const dx = 10 * (Math.random() - 0.5);
      const dy = 10 * (Math.random() - 0.5);
      this.splat(x, y, dx, dy, color);
    }
  }

  updateConfig(newConfig) {
    const prev = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    if (
      newConfig.DEBUG_OVERLAY !== undefined &&
      newConfig.DEBUG_OVERLAY !== prev.DEBUG_OVERLAY
    ) {
      this._maybeCreateDebugOverlay();
    }

    if (newConfig.QUALITY !== undefined && newConfig.QUALITY !== prev.QUALITY) {
      this.applyQualityPreset(newConfig.QUALITY);
      this.initFramebuffers();
    }

    if (
      newConfig.IOS_DPR_CAP !== undefined &&
      newConfig.IOS_DPR_CAP !== prev.IOS_DPR_CAP
    ) {
      if (this._resizeChecker()) this.initFramebuffers();
    }

    if (
      newConfig.AURA !== undefined ||
      newConfig.AURA_RESOLUTION !== undefined
    ) {
      this.initAuraFramebuffers();
    }
    if (
      newConfig.RAY_AURA !== undefined ||
      newConfig.RAY_AURA_RESOLUTION !== undefined
    ) {
      this.initRayAuraFramebuffers();
    }

    if (this.config.DEBUG_OVERLAY) this.updateDebugOverlay(true);
  }

  // Diagnostic helper
  getDiagnostics() {
    const ext = this.manager && this.manager.ext ? this.manager.ext : {};
    const webgl =
      this.manager && this.manager.webGL ? this.manager.webGL : null;
    const hwSupportsLinear = !!(ext && ext.supportLinearFiltering);
    const simulateNoFloat = !!this.config.IOS_SIMULATE_NO_FLOAT_LINEAR;
    const effectiveSupportsLinear = simulateNoFloat ? false : hwSupportsLinear;
    // Match runtime auto logic: if IOS_FILTER undefined -> use manual ONLY when HW float-linear is NOT supported.
    const manualAuto =
      this.config.IOS_FILTER === true
        ? true
        : this.config.IOS_FILTER === false
        ? false
        : !effectiveSupportsLinear;

    const usedDye8 = !!(this.dye8 && !effectiveSupportsLinear); // true when we downsampled for display
    // Provide stable numeric values for overlay (avoid null/undefined -> NaN)
    const drawingBufferWidth =
      webgl && webgl.drawingBufferWidth ? webgl.drawingBufferWidth : 0;
    const drawingBufferHeight =
      webgl && webgl.drawingBufferHeight ? webgl.drawingBufferHeight : 0;
    const dyeWidth = this.dye ? this.dye.width : 0;
    const dyeHeight = this.dye ? this.dye.height : 0;

    return {
      isIOS: !!this._isIOS,
      userAgent:
        typeof navigator !== "undefined" && navigator.userAgent
          ? navigator.userAgent
          : null,
      maxTouchPoints:
        typeof navigator !== "undefined" && navigator.maxTouchPoints
          ? navigator.maxTouchPoints
          : 0,
      userIOSFilterConfig: this.config.IOS_FILTER,
      manualFilterActive: !!manualAuto,
      displayToRGBA8: !!this.config.DISPLAY_TO_RGBA8,
      usedDye8,
      displayUseBicubic: !!this.config.DISPLAY_USE_BICUBIC,
      iosEnableBicubicOnIOS: !!this.config.IOS_ENABLE_BICUBIC_ON_IOS,
      iosSimulateNoFloatLinear: !!this.config.IOS_SIMULATE_NO_FLOAT_LINEAR,
      iosDprCap: this.config.IOS_DPR_CAP,
      isWebGL2: !!(ext && ext.isWebGL2),
      renderer: ext ? ext.renderer : null,
      vendor: ext ? ext.vendor : null,
      maxTextureSize: ext ? ext.maxTextureSize : null,
      supportLinearFiltering: !!(ext && ext.supportLinearFiltering),
      formatRGBA: ext && ext.formatRGBA ? ext.formatRGBA.internalFormat : null,
      formatRG: ext && ext.formatRG ? ext.formatRG.internalFormat : null,
      formatR: ext && ext.formatR ? ext.formatR.internalFormat : null,
      canvasWidth: this.canvas ? this.canvas.width : 0,
      canvasHeight: this.canvas ? this.canvas.height : 0,
      drawingBufferWidth,
      drawingBufferHeight,
      dyeWidth,
      dyeHeight,
      SIM_RESOLUTION: this.config.SIM_RESOLUTION,
      DYE_RESOLUTION: this.config.DYE_RESOLUTION,
      CURL: this.config.CURL,
      BRIGHTNESS: this.config.BRIGHTNESS,
      QUALITY: this.config.QUALITY,
    };
  }

  // Lightweight sanity checks and production-safety warnings.
  // This method is called once during initialization.
  _validateConfig() {
    try {
      const isProd =
        typeof process !== "undefined" &&
        process.env &&
        process.env.NODE_ENV === "production";
      // Warn if a developer-only simulation flag is enabled in production build
      // or if DEBUG_OVERLAY is left enabled.
      if (isProd && this.config.IOS_SIMULATE_NO_FLOAT_LINEAR) {
        console.warn(
          "FluidSimulation: `IOS_SIMULATE_NO_FLOAT_LINEAR` is enabled in a production build. Ensure this is intentional."
        );
      }
      if (isProd && this.config.DEBUG_OVERLAY) {
        console.info(
          "FluidSimulation: `DEBUG_OVERLAY` is enabled. You may want to disable it for production builds."
        );
      }

      const {
        SIM_RESOLUTION,
        DYE_RESOLUTION,
        COLOR_THEME,
        IOS_DPR_CAP,
      } = this.config;

      // Check numerical ranges and types
      const checkNumber = (key, min, max, integer = false) => {
        const value = this.config[key];
        if (typeof value !== "number" || isNaN(value)) {
          console.warn(
            `FluidSimulation: Configuration key \`${key}\` should be a number. Received: ${value}`
          );
          return false;
        }
        if (integer && !Number.isInteger(value)) {
          console.warn(
            `FluidSimulation: Configuration key \`${key}\` should be an integer. Received: ${value}`
          );
          return false;
        }
        if (value < min || value > max) {
          console.warn(
            `FluidSimulation: Configuration key \`${key}\` (${value}) is outside the recommended range [${min}, ${max}].`
          );
          return false;
        }
        return true;
      };

      checkNumber("SIM_RESOLUTION", 32, 256, true);
      checkNumber("DYE_RESOLUTION", 256, 4096, true);
      checkNumber("DENSITY_DISSIPATION", 0.0, 1.0);
      checkNumber("VELOCITY_DISSIPATION", 0.0, 1.0);
      checkNumber("PRESSURE_ITERATIONS", 8, 48, true);
      checkNumber("CURL", 0, 50);
      checkNumber("SPLAT_RADIUS", 0.001, 0.03);
      checkNumber("SPLAT_FORCE", 1000, 10000);
      checkNumber("BRIGHTNESS", 0.5, 2.5);
      checkNumber("MAX_DYE_UPSCALE", 1.0, 4.0);
      if (IOS_DPR_CAP !== null) checkNumber("IOS_DPR_CAP", 0.5, 3.0); // Assuming a reasonable cap range

      // Check resolution consistency
      if (DYE_RESOLUTION < SIM_RESOLUTION) {
        console.warn(
          `FluidSimulation: \`DYE_RESOLUTION\` (${DYE_RESOLUTION}) is lower than \`SIM_RESOLUTION\` (${SIM_RESOLUTION}). This might lead to visual artifacts or unexpected behavior.`
        );
      }

      // Check COLOR_THEME validity
      if (
        typeof COLOR_THEME !== "string" &&
        typeof COLOR_THEME !== "number" &&
        !Array.isArray(COLOR_THEME)
      ) {
        console.warn(
          `FluidSimulation: \`COLOR_THEME\` has an invalid type. Expected 'string', 'number', or 'array'. Received: ${typeof COLOR_THEME}`
        );
      } else if (Array.isArray(COLOR_THEME) && COLOR_THEME.length !== 2) {
        console.warn(
          `FluidSimulation: \`COLOR_THEME\` array should contain exactly two numbers [min, max]. Received array of length: ${COLOR_THEME.length}`
        );
      }

      // Sanity: dye resolution shouldn't exceed device max texture size.
      const maxTex =
        this.manager && this.manager.ext
          ? this.manager.ext.maxTextureSize
          : null;
      if (
        maxTex && DYE_RESOLUTION && DYE_RESOLUTION > maxTex
      ) {
        console.warn(
          `FluidSimulation: \`DYE_RESOLUTION\` (${DYE_RESOLUTION}) exceeds device max texture size (${maxTex}). Consider lowering it.`
        );
      }
    } catch (_e) {
      /* fail silently if env isn't available */
    }
  }
}
