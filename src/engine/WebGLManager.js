// src/engine/WebGLManager.js

class GLProgram {
  constructor(gl, vertexShaderSource, fragmentShaderSource) {
    this.gl = gl;
    this.uniforms = {};
    this.program = gl.createProgram();

    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(this.program)}`);
    }

    const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
      const uniformName = gl.getActiveUniform(this.program, i).name;
      this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
    }
  }

  _compileShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(`An error occurred compiling the shaders: ${this.gl.getShaderInfoLog(shader)}`);
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  bind() {
    this.gl.useProgram(this.program);
  }
}

export class WebGLManager {
  constructor(canvas, config) {
    const { webGL, ext } = this._getWebGLContext(canvas, config);
    this.webGL = webGL;
    this.ext = ext;

    if (this.webGL) {
      this.blit = this._createBlit(this.webGL);
    }
  }

  _getWebGLContext(canvas, config) {
    const params = {
      alpha: config.TRANSPARENT,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    };

    const ext = {};

    let webGL = canvas.getContext("webgl2", params);
    const isWebGL2 = !!webGL;
    if (!isWebGL2) {
      webGL = canvas.getContext("webgl", params) || canvas.getContext("experimental-web-gl", params);
    }

    if (!webGL) return { webGL: null, ext: {} };
    
    // Expose whether this is WebGL2
    ext.isWebGL2 = isWebGL2;
    
    // Read debug renderer info if available (helps identify iOS driver quirks)
    const dbgExt = webGL.getExtension("WEBGL_debug_renderer_info");
    if (dbgExt) {
      try {
        ext.renderer = webGL.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL);
        ext.vendor = webGL.getParameter(dbgExt.UNMASKED_VENDOR_WEBGL);
      } catch (_e) {
        ext.renderer = null;
        ext.vendor = null;
      }
    } else {
      ext.renderer = null;
      ext.vendor = null;
    }
    
    // useful capability info
    ext.maxTextureSize = webGL.getParameter(webGL.MAX_TEXTURE_SIZE);

    let halfFloat, halfFloatTexType;
    let supportLinearFiltering;

    if (isWebGL2) {
      // request color-buffer float extension (best-effort)
      webGL.getExtension("EXT_color_buffer_float");
      // WebGL2 implementations expose different extension sets; check for both float & half-float linear support.
      const floatLinear = !!(webGL.getExtension("OES_texture_float_linear") || webGL.getExtension("EXT_color_buffer_float"));
      const halfFloatLinear = !!webGL.getExtension("OES_texture_half_float_linear");
      halfFloatTexType = webGL.HALF_FLOAT;
      supportLinearFiltering = floatLinear || halfFloatLinear;
    } else {
      // WebGL1: try to detect either float-linear or half-float-linear extensions
      halfFloat = webGL.getExtension("OES_texture_half_float");
      const halfFloatLinear = !!webGL.getExtension("OES_texture_half_float_linear");
      const floatLinear = !!webGL.getExtension("OES_texture_float_linear");
      halfFloatTexType = halfFloat ? halfFloat.HALF_FLOAT_OES : null;
      supportLinearFiltering = floatLinear || halfFloatLinear;
    }

    ext.supportLinearFiltering = !!supportLinearFiltering;

    if (config.TRANSPARENT) {
      webGL.clearColor(0.0, 0.0, 0.0, 0.0);
    } else {
      webGL.clearColor(
        config.BACK_COLOR.r / 255.0,
        config.BACK_COLOR.g / 255.0,
        config.BACK_COLOR.b / 255.0,
        1.0
      );
    }

    ext.halfFloatTexType = halfFloatTexType;

    function getSupportedFormat(internalFormat, format, type) {
      if (!this._supportRenderTextureFormat(webGL, internalFormat, format, type)) {
        switch (internalFormat) {
          case webGL.R16F:
            return getSupportedFormat.call(this, webGL.RG16F, webGL.RG, type);
          case webGL.RG16F:
            return getSupportedFormat.call(this, webGL.RGBA16F, webGL.RGBA, type);
          default:
            return null;
        }
      }
      return { internalFormat, format };
    }

    const boundGetSupportedFormat = getSupportedFormat.bind(this);

    if (isWebGL2) {
      ext.formatRGBA = ext.formatRG = ext.formatR = boundGetSupportedFormat(webGL.RGBA16F, webGL.RGBA, halfFloatTexType);
    } else {
      ext.formatRGBA = ext.formatRG = ext.formatR = boundGetSupportedFormat(webGL.RGBA, webGL.RGBA, halfFloatTexType);
    }

    // If any of the formats are null, it means we don't have the necessary support.
    if (!ext.formatRGBA || !ext.formatRG || !ext.formatR) {
      console.error("Could not find supported floating point texture formats.");
      return { webGL: null, ext: {} };
    }

    return { webGL, ext };
  }

  _supportRenderTextureFormat(gl, internalFormat, format, type) {
    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status === gl.FRAMEBUFFER_COMPLETE;
  }

  createProgram(vertexShaderSource, fragmentShaderSource) {
    return new GLProgram(this.webGL, vertexShaderSource, fragmentShaderSource);
  }

  createFBO(w, h, internalFormat, format, type, param) {
    const { webGL: gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX: 1.0 / w,
      texelSizeY: 1.0 / h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  createDoubleFBO(w, h, internalFormat, format, type, param) {
    let fbo1 = this.createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = this.createFBO(w, h, internalFormat, format, type, param);

    return {
      width: w,
      height: h,
      texelSizeX: fbo1.texelSizeX,
      texelSizeY: fbo1.texelSizeY,
      get read() {
        return fbo1;
      },
      set read(value) {
        fbo1 = value;
      },
      get write() {
        return fbo2;
      },
      set write(value) {
        fbo2 = value;
      },
      swap() {
        let temp = fbo1;
        fbo1 = fbo2;
        fbo2 = temp;
      },
    };
  }

  _createBlit(gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    return (destination) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  }
}
