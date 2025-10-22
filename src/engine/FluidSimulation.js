import { WebGLManager } from "../engine/WebGLManager";
import * as shaders from "../shaders/shaders";
import { Pointer } from "../utils/Pointer";

export class FluidSimulation {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = { ...config }; // Use a copy

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
  }

  _initPrograms() {
    this.programs = {
      splat: this.manager.createProgram(shaders.baseVertexShader, shaders.splatShader),
      divergence: this.manager.createProgram(shaders.baseVertexShader, shaders.divergenceShader),
      curl: this.manager.createProgram(shaders.baseVertexShader, shaders.curlShader),
      vorticity: this.manager.createProgram(shaders.baseVertexShader, shaders.vorticityShader),
      pressure: this.manager.createProgram(shaders.baseVertexShader, shaders.pressureShader),
      gradientSubtract: this.manager.createProgram(shaders.baseVertexShader, shaders.gradientSubtractShader),
      auraMask: this.manager.createProgram(shaders.baseVertexShader, shaders.sunraysMaskShader), // Can reuse the same mask logic
      aura: this.manager.createProgram(shaders.baseVertexShader, shaders.blurShader), // Use the new blur shader
      rayAuraMask: this.manager.createProgram(shaders.baseVertexShader, shaders.sunraysMaskShader),
      rayAura: this.manager.createProgram(shaders.baseVertexShader, shaders.rayAuraShader),
      display: this.manager.createProgram(shaders.baseVertexShader, shaders.displayShader),
      copy: this.manager.createProgram(shaders.baseVertexShader, shaders.copyShader),
      advection: this.manager.createProgram(shaders.baseVertexShader, shaders.advectionShader),
    };
  }

  initFramebuffers() {
    const { webGL, ext: webGLExt } = this.manager;
    const simWidth = this.config.SIM_RESOLUTION;
    const simHeight = this.config.SIM_RESOLUTION;
    const dyeRes = this.config.DYE_RESOLUTION;

    const dyeWidth = dyeRes;
    const dyeHeight = dyeRes

    this.textureWidth = simWidth;
    this.textureHeight = simHeight;

    const texType = webGLExt.halfFloatTexType;
    const rgba = webGLExt.formatRGBA;
    const rg = webGLExt.formatRG;
    const r = webGLExt.formatR;
    const filtering = webGLExt.supportLinearFiltering ? webGL.LINEAR : webGL.NEAREST;

    if (this.dye == null || this.dye.width !== dyeWidth || this.dye.height !== dyeHeight) {
        this.dye = this.manager.createDoubleFBO(dyeWidth, dyeHeight, rgba.internalFormat, rgba.format, texType, filtering);
    }

    this.velocity = this.manager.createDoubleFBO(this.textureWidth, this.textureHeight, rg.internalFormat, rg.format, texType, filtering);
    this.divergence = this.manager.createFBO(this.textureWidth, this.textureHeight, r.internalFormat, r.format, texType, webGL.NEAREST);
    this.curl = this.manager.createFBO(this.textureWidth, this.textureHeight, r.internalFormat, r.format, texType, webGL.NEAREST);
    this.pressure = this.manager.createDoubleFBO(this.textureWidth, this.textureHeight, r.internalFormat, r.format, texType, webGL.NEAREST);

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
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      return true;
    }
    return false;
  }

  splat(x, y, dx, dy, color) {
    const { webGL, blit } = this.manager;
    const splatProgram = this.programs.splat;

    // Splat velocity
    webGL.viewport(0, 0, this.velocity.width, this.velocity.height);
    splatProgram.bind();
    webGL.uniform1i(splatProgram.uniforms.uTarget, this.velocity.read.attach(0));
    webGL.uniform1f(splatProgram.uniforms.aspectRatio, this.canvas.clientWidth / this.canvas.clientHeight);
    webGL.uniform2f(splatProgram.uniforms.point, x, y);    
    webGL.uniform3f(splatProgram.uniforms.color, dx, dy, 1.0);
    webGL.uniform1f(splatProgram.uniforms.brightness, 1.0); // Full brightness for velocity
    webGL.uniform1f(splatProgram.uniforms.radius, this.config.SPLAT_RADIUS / 5.0);
    blit(this.velocity.write.fbo);
    this.velocity.swap();

    // Splat dye
    webGL.viewport(0, 0, this.dye.width, this.dye.height);
    splatProgram.bind();
    webGL.uniform1i(splatProgram.uniforms.uTarget, this.dye.read.attach(0));
    webGL.uniform1f(splatProgram.uniforms.aspectRatio, this.canvas.clientWidth / this.canvas.clientHeight);
    webGL.uniform2f(splatProgram.uniforms.point, x, y);
    webGL.uniform1f(splatProgram.uniforms.brightness, this.config.AURA ? 0.6 : 1.0); // Slightly increased brightness for dye when aura is active
    webGL.uniform1f(splatProgram.uniforms.radius, this.config.SPLAT_RADIUS);
    webGL.uniform3f(splatProgram.uniforms.color, color[0], color[1], color[2]);
    blit(this.dye.write.fbo);
    this.dye.swap();
  }

  addSplat(pointer) {
    this.splatStack.push(pointer);
  }

  _updateSplats() {
    this.splatStack.forEach(pointer => {
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

    // Create or resize the main aura FBO
    this.aura = this.manager.createFBO(res, res, rgba.internalFormat, rgba.format, texType, filtering);
    // Create or resize the temporary FBO for the blur pass
    this.auraTemp = this.manager.createFBO(res, res, rgba.internalFormat, rgba.format, texType, filtering);
    // Create or resize the mask FBO
    this.auraMask = this.manager.createFBO(res, res, rgba.internalFormat, rgba.format, texType, filtering);
  }

  _applyAura(source, mask, destination) {
    const { webGL, blit } = this.manager;
    const { auraMask: maskProgram, aura: blurProgram } = this.programs;

    // 1. Create the mask from the dye texture
    maskProgram.bind();
    webGL.uniform1i(maskProgram.uniforms.uTexture, source.read.attach(0));
    webGL.viewport(0, 0, mask.width, mask.height);
    blit(mask.fbo);

    // 2. Horizontal blur pass
    blurProgram.bind();
    webGL.uniform1f(blurProgram.uniforms.weight, this.config.AURA_WEIGHT);
    webGL.uniform2f(blurProgram.uniforms.texelSize, 1.0 / mask.width, 0.0);
    webGL.uniform1i(blurProgram.uniforms.uTexture, mask.attach(0));
    blit(this.auraTemp.fbo); // Blur from mask to temp

    // 3. Vertical blur pass
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

    this.rayAura = this.manager.createFBO(res, res, rgba.internalFormat, rgba.format, texType, filtering);
    this.rayAuraMask = this.manager.createFBO(res, res, rgba.internalFormat, rgba.format, texType, filtering);
  }

  _applyRayAura(source, mask, destination) {
    const { webGL, blit } = this.manager;
    const { rayAuraMask: maskProgram, rayAura: auraProgram } = this.programs;

    webGL.disable(webGL.BLEND);
    maskProgram.bind();
    webGL.uniform1i(maskProgram.uniforms.uTexture, source.read.attach(0));
    webGL.viewport(0, 0, mask.width, mask.height);
    blit(mask.fbo);

    auraProgram.bind();
    webGL.uniform1f(auraProgram.uniforms.weight, this.config.RAY_AURA_WEIGHT);
    webGL.uniform1i(auraProgram.uniforms.uTexture, mask.attach(0));
    webGL.viewport(0, 0, destination.width, destination.height);
    blit(destination.fbo);
  }

  _update(dt) {
    const { webGL, blit } = this.manager;
    const {
        curl: curlProgram,
        vorticity: vorticityProgram,
        divergence: divergenceProgram,
        advection: advectionProgram,
        pressure: pressureProgram,
        gradientSubtract: gradientSubtractProgram,
        display: displayProgram,
    } = this.programs;

    webGL.viewport(0, 0, this.textureWidth, this.textureHeight);
    advectionProgram.bind();
    webGL.uniform2f(advectionProgram.uniforms.velocityTexelSize, 1.0 / this.textureWidth, 1.0 / this.textureHeight);
    webGL.uniform1i(advectionProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    webGL.uniform1i(advectionProgram.uniforms.uSource, this.velocity.read.attach(0)); // Advect velocity through itself
    webGL.uniform1f(advectionProgram.uniforms.dt, dt);
    webGL.uniform1f(advectionProgram.uniforms.dissipation, this.config.VELOCITY_DISSIPATION);
    blit(this.velocity.write.fbo);
    this.velocity.swap();

    curlProgram.bind();
    webGL.uniform2f(curlProgram.uniforms.texelSize, 1.0 / this.textureWidth, 1.0 / this.textureHeight);
    webGL.uniform1i(curlProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    blit(this.curl.fbo);

    vorticityProgram.bind();
    webGL.uniform2f(vorticityProgram.uniforms.texelSize, 1.0 / this.textureWidth, 1.0 / this.textureHeight);
    webGL.uniform1i(vorticityProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    webGL.uniform1i(vorticityProgram.uniforms.uCurl, this.curl.attach(1));
    webGL.uniform1f(vorticityProgram.uniforms.curl, this.config.CURL);
    webGL.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(this.velocity.write.fbo);

    this.velocity.swap();

    divergenceProgram.bind();
    webGL.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / this.textureWidth, 1.0 / this.textureHeight);
    webGL.uniform1i(divergenceProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    blit(this.divergence.fbo);

    pressureProgram.bind();
    webGL.uniform2f(pressureProgram.uniforms.texelSize, 1.0 / this.textureWidth, 1.0 / this.textureHeight);
    webGL.uniform1i(pressureProgram.uniforms.uDivergence, this.divergence.attach(0));
    for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
      webGL.uniform1i(pressureProgram.uniforms.uPressure, this.pressure.read.attach(1));
      blit(this.pressure.write.fbo);
      this.pressure.swap();
    }

    gradientSubtractProgram.bind();
    webGL.uniform2f(gradientSubtractProgram.uniforms.texelSize, 1.0 / this.textureWidth, 1.0 / this.textureHeight);
    webGL.uniform1i(gradientSubtractProgram.uniforms.uPressure, this.pressure.read.attach(0));
    webGL.uniform1i(gradientSubtractProgram.uniforms.uVelocity, this.velocity.read.attach(1));
    blit(this.velocity.write.fbo);
    this.velocity.swap();
    
    webGL.viewport(0, 0, this.dye.width, this.dye.height);
    advectionProgram.bind();
    webGL.uniform2f(advectionProgram.uniforms.velocityTexelSize, 1.0 / this.textureWidth, 1.0 / this.textureHeight);
    webGL.uniform1i(advectionProgram.uniforms.uVelocity, this.velocity.read.attach(0));
    webGL.uniform1i(advectionProgram.uniforms.uSource, this.dye.read.attach(1)); // Advect dye through the velocity field
    webGL.uniform1f(advectionProgram.uniforms.dt, dt);
    webGL.uniform1f(advectionProgram.uniforms.dissipation, this.config.DENSITY_DISSIPATION);
    blit(this.dye.write.fbo);
    this.dye.swap();

    // Post-processing
    if (this.config.AURA) {
        this._applyAura(this.dye, this.auraMask, this.aura);
    }

    if (this.config.RAY_AURA) {
        this._applyRayAura(this.dye, this.rayAuraMask, this.rayAura);
    }

    // Render to canvas
    webGL.viewport(0, 0, webGL.drawingBufferWidth, webGL.drawingBufferHeight);
    displayProgram.bind();
    webGL.uniform1i(displayProgram.uniforms.uTexture, this.dye.read.attach(0));
    webGL.uniform1i(displayProgram.uniforms.uAura, this.aura.attach(1)); // Pass the aura texture
    webGL.uniform1i(displayProgram.uniforms.uShadingEnabled, this.config.SHADING);
    webGL.uniform2f(displayProgram.uniforms.dyeTexelSize, 1.0 / this.dye.width, 1.0 / this.dye.height);
    webGL.uniform1i(displayProgram.uniforms.transparent, this.config.TRANSPARENT);
    webGL.uniform1i(displayProgram.uniforms.uAuraEnabled, this.config.AURA);
    webGL.uniform1f(displayProgram.uniforms.uBrightness, this.config.BRIGHTNESS);
    webGL.uniform1i(displayProgram.uniforms.uRayAuraEnabled, this.config.RAY_AURA);
    webGL.uniform1i(displayProgram.uniforms.uRayAura, this.rayAura.attach(2));
    webGL.uniform3f(
      displayProgram.uniforms.backColor,
      this.config.BACK_COLOR.r / 255.0,
      this.config.BACK_COLOR.g / 255.0,
      this.config.BACK_COLOR.b / 255.0
    );
    blit(null);
  }

  _tick() {
    const dt = this._calcDeltaTime();
    if (this._resizeChecker()) {
      this.initFramebuffers();
    }

    this._updateSplats();
    this._update(dt);
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
    this.config = { ...this.config, ...newConfig };
    if (newConfig.AURA !== undefined || newConfig.AURA_RESOLUTION !== undefined) {
        this.initAuraFramebuffers();
    }
    if (newConfig.RAY_AURA !== undefined || newConfig.RAY_AURA_RESOLUTION !== undefined) {
        this.initRayAuraFramebuffers();
    }
  }
}