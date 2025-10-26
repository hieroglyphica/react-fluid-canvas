/** Base vertex shader for fullscreen passes. Sets up UVs and varying coordinates for neighboring texels. */
export const baseVertexShader = /* glsl */ `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main () {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
`;

/** Fades out a texture by multiplying it by a value slightly less than 1. Used for dissipation. */
export const clearShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;
    void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
    }
`;

/** Fills the screen with a solid color. */
export const colorShader = /* glsl */ `
    precision mediump float;
    uniform vec4 color;
    void main () {
        gl_FragColor = color;
    }
`;

/* Advection: supports manual bilinear (bilerp) fallback using texel-center sampling */
export const advectionShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 velocityTexelSize;
    uniform vec2 sourceTexelSize;
    uniform float dt;
    uniform float dissipation;
    uniform bool uManualFilter;

    // bilerp: sample texel centers using floor(...) + 0.5 and use fractional weights
    vec4 bilerp(sampler2D source, vec2 uv, vec2 texelSize) {
        vec2 f = fract(uv / texelSize - 0.5);
        vec2 coord = (floor(uv / texelSize - 0.5) + 0.5) * texelSize;

        vec4 a = texture2D(source, coord);
        vec4 b = texture2D(source, coord + vec2(texelSize.x, 0.0));
        vec4 c = texture2D(source, coord + vec2(0.0, texelSize.y));
        vec4 d = texture2D(source, coord + texelSize);
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main () {
        vec2 vel = texture2D(uVelocity, vUv).xy;
        vec2 coord = vUv - dt * vel * velocityTexelSize;

        if (uManualFilter) {
            gl_FragColor = dissipation * bilerp(uSource, coord, sourceTexelSize);
        } else {
            gl_FragColor = dissipation * texture2D(uSource, coord);
        }
        gl_FragColor.a = 1.0;
    }
`;

/** Divergence shader */
export const divergenceShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    void main () {
        vec2 vL = vUv - vec2(texelSize.x, 0.0);
        vec2 vR = vUv + vec2(texelSize.x, 0.0);
        vec2 vT = vUv + vec2(0.0, texelSize.y);
        vec2 vB = vUv - vec2(0.0, texelSize.y);
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x; 
        float T = texture2D(uVelocity, vT).y; 
        float B = texture2D(uVelocity, vB).y; 
        vec2 C = texture2D(uVelocity, vUv).xy; 
        if (vL.x < 0.0) { L = -C.x; } 
        if (vR.x > 1.0) { R = -C.x; } 
        if (vT.y > 1.0) { T = -C.y; } 
        if (vB.y < 0.0) { B = -C.y; } 
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
`;

/** Curl */
export const curlShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    void main () {
        vec2 vL = vUv - vec2(texelSize.x, 0.0);
        vec2 vR = vUv + vec2(texelSize.x, 0.0);
        vec2 vT = vUv + vec2(0.0, texelSize.y);
        vec2 vB = vUv - vec2(0.0, texelSize.y);
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
`;

/** Vorticity confinement */
export const vorticityShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;
    uniform vec2 texelSize;
    void main () {
        vec2 vL = vUv - vec2(texelSize.x, 0.0);
        vec2 vR = vUv + vec2(texelSize.x, 0.0);
        vec2 vT = vUv + vec2(0.0, texelSize.y);
        vec2 vB = vUv - vec2(0.0, texelSize.y);
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity += force * dt;
        velocity = min(max(velocity, -1000.0), 1000.0);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`;

/** Pressure (Jacobi) */
export const pressureShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;
    varying vec2 vUv;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    uniform vec2 texelSize;
    void main () {
        vec2 vL = vUv - vec2(texelSize.x, 0.0);
        vec2 vR = vUv + vec2(texelSize.x, 0.0);
        vec2 vT = vUv + vec2(0.0, texelSize.y);
        vec2 vB = vUv - vec2(0.0, texelSize.y);
        float L = texture2D(uPressure, vL).r;
        float R = texture2D(uPressure, vR).r;
        float T = texture2D(uPressure, vT).r;
        float B = texture2D(uPressure, vB).r;
        if (vL.x < 0.0) { L = R; }
        if (vR.x > 1.0) { R = L; }
        if (vT.y > 1.0) { T = B; }
        if (vB.y < 0.0) { B = T; }
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
`;

/** Gradient subtract */
export const gradientSubtractShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;
    varying vec2 vUv;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    uniform vec2 texelSize;
    void main () {
        vec2 vL = vUv - vec2(texelSize.x, 0.0);
        vec2 vR = vUv + vec2(texelSize.x, 0.0);
        vec2 vT = vUv + vec2(0.0, texelSize.y);
        vec2 vB = vUv - vec2(0.0, texelSize.y);
        float L = texture2D(uPressure, vL).r;
        float R = texture2D(uPressure, vR).r;
        float T = texture2D(uPressure, vT).r;
        float B = texture2D(uPressure, vB).r;
        if (vL.x < 0.0) { L = texture2D(uPressure, vUv).r; }
        if (vR.x > 1.0) { R = texture2D(uPressure, vUv).r; }
        if (vT.y > 1.0) { T = texture2D(uPressure, vUv).r; }
        if (vB.y < 0.0) { B = texture2D(uPressure, vUv).r; }
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= 0.5 * vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
`;

/** Splat */
export const splatShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    uniform float brightness;
    void main() {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color * brightness;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
    }
`;

/** Display shader: supports manual bilinear sampling + boost toward center sample */
export const displayShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform sampler2D uAura;
    uniform sampler2D uRayAura;
    uniform vec3 backColor;
    uniform bool transparent;
    uniform bool uAuraEnabled;
    uniform bool uRayAuraEnabled;
    uniform bool uShadingEnabled;
    uniform vec2 dyeTexelSize;
    uniform float uBrightness;
    uniform bool uManualFilter;
    uniform float uManualFilterBoost;

    // Manual bilinear sampling helper (bilerp) with optional boost toward center sample
    vec3 sampleBilinearRGB(sampler2D samp, vec2 uv, vec2 texelSize, float boost) {
        vec2 f = fract(uv / texelSize - 0.5);
        vec2 coord = (floor(uv / texelSize - 0.5) + 0.5) * texelSize;

        vec3 a = texture2D(samp, coord).rgb;
        vec3 b = texture2D(samp, coord + vec2(texelSize.x, 0.0)).rgb;
        vec3 c = texture2D(samp, coord + vec2(0.0, texelSize.y)).rgb;
        vec3 d = texture2D(samp, coord + texelSize).rgb;
        vec3 bil = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);

        if (boost <= 0.0) return bil;
        return mix(bil, a, clamp(boost, 0.0, 1.0));
    }

    // Catmull-Rom cubic weight + bicubic (kept for optional high-quality path)
    float cubicWeight(float x) {
        x = abs(x);
        if (x <= 1.0) return (1.5 * x - 2.5) * x * x + 1.0;
        if (x < 2.0) return ((-0.5 * x + 2.5) * x - 4.0) * x + 2.0;
        return 0.0;
    }
    vec3 sampleBicubicRGB(sampler2D samp, vec2 uv, vec2 texelSize) {
        vec2 pixel = uv / texelSize;
        vec2 base = floor(pixel) - 1.0;
        vec3 sum = vec3(0.0);
        float wsum = 0.0;
        for (int j = 0; j < 4; j++) {
            for (int i = 0; i < 4; i++) {
                vec2 p = (base + vec2(float(i), float(j))) * texelSize;
                vec3 c = texture2D(samp, p).rgb;
                float wx = cubicWeight(pixel.x - (base.x + float(i)));
                float wy = cubicWeight(pixel.y - (base.y + float(j)));
                float w = wx * wy;
                sum += c * w;
                wsum += w;
            }
        }
        return sum / (wsum + 1e-6);
    }

    void main () {
        vec3 C;
        if (uManualFilter) {
            // choose bilinear/manual path (bicubic optional elsewhere)
            C = clamp(sampleBilinearRGB(uTexture, vUv, dyeTexelSize, uManualFilterBoost), 0.0, 2.0);
        } else {
            C = clamp(texture2D(uTexture, vUv).rgb, 0.0, 2.0);
        }

        if (uShadingEnabled) {
            vec3 L = texture2D(uTexture, vUv - vec2(dyeTexelSize.x, 0.0)).rgb;
            vec3 R = texture2D(uTexture, vUv + vec2(dyeTexelSize.x, 0.0)).rgb;
            vec3 T = texture2D(uTexture, vUv + vec2(0.0, dyeTexelSize.y)).rgb;
            vec3 B = texture2D(uTexture, vUv - vec2(0.0, dyeTexelSize.y)).rgb;
            float gradient = (length(R - L) + length(T - B)) * 0.25;
            C = C * (1.0 - gradient * 2.0) + C * 0.2;
        }

        if (uAuraEnabled) C += texture2D(uAura, vUv).rgb;
        if (uRayAuraEnabled) C += texture2D(uRayAura, vUv).rgb;

        C = clamp(C * uBrightness, 0.0, 1.0);
        float finalAlpha = max(C.r, max(C.g, C.b));
        if (transparent) {
            gl_FragColor = vec4(C, finalAlpha);
        } else {
            gl_FragColor = vec4(mix(backColor, C, finalAlpha), 1.0);
        }
    }
`;

/** Sunrays mask */
export const sunraysMaskShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    void main () {
        vec4 c = texture2D(uTexture, vUv);
        float brightness = max(c.r, max(c.g, c.b));
        c.a = brightness;
        gl_FragColor = c;
    }
`;

/** Ray aura shader (kept) */
export const rayAuraShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float weight;
    #define ITERATIONS 16
    void main () {
        float Density = 0.3;
        float Decay = 0.97;
        float Exposure = 0.25;
        vec2 coord = vUv;
        vec2 dir = vUv - 0.5;
        dir *= 1.0 / float(ITERATIONS) * Density;
        float illuminationDecay = 1.0;
        vec3 color = vec3(0.0);
        for (int i = 0; i < ITERATIONS; i++) {
            coord -= dir;
            vec4 tex = texture2D(uTexture, coord);
            float sample = tex.a;
            color += tex.rgb * sample * illuminationDecay * weight;
            illuminationDecay *= Decay;
        }
        gl_FragColor = vec4(color * Exposure, 1.0);
    }
`;

/** Blur shader (used for aura) */
export const blurShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 texelSize;
    uniform float weight;
    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb * 0.2 * weight;
        c += texture2D(uTexture, vUv + texelSize * 1.5).rgb * 0.15 * weight;
        c += texture2D(uTexture, vUv - texelSize * 1.5).rgb * 0.15 * weight;
        c += texture2D(uTexture, vUv + texelSize * 3.5).rgb * 0.1 * weight;
        c += texture2D(uTexture, vUv - texelSize * 3.5).rgb * 0.1 * weight;
        c += texture2D(uTexture, vUv + texelSize * 5.5).rgb * 0.05 * weight;
        c += texture2D(uTexture, vUv - texelSize * 5.5).rgb * 0.05 * weight;
        gl_FragColor = vec4(c, 1.0);
    }
`;

export const copyShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;

    varying highp vec2 vUv;
    uniform sampler2D uTexture;

    void main () {
        gl_FragColor = texture2D(uTexture, vUv);
    }
`;

/* Downsample shader: maps high-precision dye -> 8-bit dye8 using pixel-center sampling.
   Expects:
    - sampler2D uSource
    - vec2 srcSize (width,height)
    - vec2 destSize (width,height)
*/
export const downsampleShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uSource;
    uniform vec2 srcSize;
    uniform vec2 destSize;

    vec4 sampleBilerp(sampler2D src, vec2 uv, vec2 texelSize) {
        // use explicit vec2 constants to avoid scalar->vec mixing
        vec2 f = fract(uv / texelSize - vec2(0.5));
        vec2 coord = (floor(uv / texelSize - vec2(0.5)) + vec2(0.5)) * texelSize;
        vec4 a = texture2D(src, coord);
        vec4 b = texture2D(src, coord + vec2(texelSize.x, 0.0));
        vec4 c = texture2D(src, coord + vec2(0.0, texelSize.y));
        vec4 d = texture2D(src, coord + texelSize);
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
        // Determine integer dest pixel coord for this fragment
        vec2 p = floor(vUv * destSize);
        // Map the dest pixel center into source-space uv:
        // source pixel center (in normalized space) = (p + 0.5) / destSize
        vec2 srcUV = (p + vec2(0.5)) / destSize;
        // Convert to source texel size
        vec2 srcTexel = 1.0 / srcSize;
        // Sample the source using bilerp (texel-center sampling)
        vec4 col = sampleBilerp(uSource, srcUV, srcTexel);
        // Simple clamp/tonemap to avoid blown highlights when converting to 8-bit
        vec3 mapped = col.rgb / (col.rgb + vec3(1.0));
        mapped = pow(mapped, vec3(1.0 / 1.1)); // slight gamma
        gl_FragColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
    }
`;

/* Sharpen shader: simple unsharp mask on the 8-bit intermediate.
   Expects:
    - sampler2D uTexture
    - vec2 texelSize
    - float amount (0..1)
*/
export const sharpenShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 texelSize;
    uniform float amount;

    void main() {
        vec3 c = texture2D(uTexture, vUv).rgb;
        // 4-neighbor blur - initialize as vec3 to avoid scalar->vec assignment
        vec3 blur = vec3(0.0);
        blur += texture2D(uTexture, vUv + vec2(texelSize.x, 0.0)).rgb;
        blur += texture2D(uTexture, vUv - vec2(texelSize.x, 0.0)).rgb;
        blur += texture2D(uTexture, vUv + vec2(0.0, texelSize.y)).rgb;
        blur += texture2D(uTexture, vUv - vec2(0.0, texelSize.y)).rgb;
        blur = blur * 0.25;
        // unsharp mask
        vec3 result = c + amount * (c - blur);
        result = clamp(result, 0.0, 1.0);
        gl_FragColor = vec4(result, 1.0);
    }
`;
