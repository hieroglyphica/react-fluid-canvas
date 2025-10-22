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

/** Moves a quantity (like dye or velocity) through the velocity field, relying on the GPU's built-in linear filtering. */
export const advectionShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 velocityTexelSize;
    uniform float dt;
    uniform float dissipation;
    void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * velocityTexelSize;
        gl_FragColor = dissipation * texture2D(uSource, coord);
        gl_FragColor.a = 1.0;
    }
`;

/** Calculates the divergence of the velocity field. Divergence is the amount of flow leaving a point. */
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

/** Calculates the curl (or vorticity) of the velocity field. Curl represents the local spinning motion of the fluid. */
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

/** Applies a confinement force based on the curl to add back small-scale details and turbulence lost during simulation steps. */
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

/** Iteratively solves for the pressure field using the Jacobi method. Pressure is used to make the velocity field divergence-free. */
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

/** Subtracts the pressure gradient from the velocity field to make it incompressible (divergence-free). */
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

/** Draws a "splat" (a Gaussian-shaped blob) of color or velocity onto a texture at a user-defined point. */
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

/** Renders the final dye texture to the screen, with options for a background color or transparency. */
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

    // Screen blend mode
    vec3 screen(vec3 base, vec3 blend) {
        return 1.0 - (1.0 - base) * (1.0 - blend);
    }

    // ACES Filmic Tone Mapping
    vec3 aces_tonemap(vec3 x) {
        const float a = 2.51;
        const float b = 0.03;
        const float c = 2.43;
        const float d = 0.59;
        const float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    // HSV/RGB conversion functions
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    vec3 adjust_color(vec3 color, float brightness, float saturation_boost) {
        vec3 hsv = rgb2hsv(color);
        hsv.y = clamp(hsv.y * saturation_boost, 0.0, 1.0); // Boost saturation
        hsv.z *= brightness; // Apply brightness
        return hsv2rgb(hsv);
    }

    void main () {
        // Clamp the color to prevent NaNs in the gradient calculation
        vec3 C = clamp(texture2D(uTexture, vUv).rgb, 0.0, 2.0);
        float a = max(C.r, max(C.g, C.b));

        if (uShadingEnabled) {
            vec3 L = texture2D(uTexture, vUv - vec2(dyeTexelSize.x, 0.0)).rgb;
            vec3 R = texture2D(uTexture, vUv + vec2(dyeTexelSize.x, 0.0)).rgb;
            vec3 T = texture2D(uTexture, vUv + vec2(0.0, dyeTexelSize.y)).rgb;
            vec3 B = texture2D(uTexture, vUv - vec2(0.0, dyeTexelSize.y)).rgb;
            float gradient = (length(R - L) + length(T - B)) * 0.25;
            C = C * (1.0 - gradient * 2.0) + C * 0.2;
        }

        if (uAuraEnabled) {
           C += texture2D(uAura, vUv).rgb; // Additive blending for a glowing effect
        }

        if (uRayAuraEnabled) {
           C += texture2D(uRayAura, vUv).rgb; // Additive blending for a glowing effect
          
        }

        // Adjust brightness and saturation in HSV space for better color fidelity
        C = adjust_color(C, uBrightness, 1.2); // 1.2 is a gentle saturation boost

        // Apply tone mapping to prevent colors from washing out to white
        C = aces_tonemap(C);

        // Calculate final alpha after all effects are applied
        float finalAlpha = max(C.r, max(C.g, C.b));

        if (transparent) { // If background is transparent, blend dye with alpha
            gl_FragColor = vec4(C, finalAlpha);
        } else { // If background is opaque, mix dye with background color
            gl_FragColor = vec4(mix(backColor, C, finalAlpha), 1.0);
        }
    }
`;

/** Creates a mask from the bright areas of the dye texture, which is used to generate sunrays. */
export const sunraysMaskShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    void main () {
        vec4 c = texture2D(uTexture, vUv);
        float brightness = max(c.r, max(c.g, c.b));
        c.a = brightness; // Store brightness in alpha channel
        gl_FragColor = c;
    }
`;

/** Generates a radial blur effect (sunrays) from a light source, using a mask texture. */
export const rayAuraShader = /* glsl */ `
    precision highp float;
    precision highp sampler2D;

    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform float weight;

    #define ITERATIONS 16

    // HSV/RGB conversion functions needed for iridescence
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    // Hash function for pseudo-randomness
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main () {
        float Density = 0.3;
        float Decay = 0.97;
        float Exposure = 0.25;

        vec2 coord = vUv;
        vec2 dir = vUv - 0.5;

        dir *= 1.0 / float(ITERATIONS) * Density;
        float illuminationDecay = 1.0;

        vec3 color = vec3(0.0);

        for (int i = 0; i < ITERATIONS; i++)
        {
            coord -= dir;
            vec4 tex = texture2D(uTexture, coord);
            float sample = tex.a;

            // Use a hash function to create a shimmering, iridescent effect
            float random = hash(coord);
            
            // Take the original color and shift its hue for iridescence
            vec3 baseColor = tex.rgb;
            vec3 hsv = rgb2hsv(baseColor);
            hsv.x = fract(hsv.x + random * 0.2); // Shift hue
            vec3 iridescentColor = hsv2rgb(hsv);

            color += iridescentColor * sample * illuminationDecay * weight;

            illuminationDecay *= Decay;
        }

        gl_FragColor = vec4(color * Exposure, 1.0);
    }
`;

/** Blurs an image in one direction (horizontal or vertical). Used for the AURA glow. */
export const blurShader = /* glsl */ `
    precision mediump float;
    precision mediump sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 texelSize;
    uniform float weight;
    void main () {
        vec3 c = texture2D(uTexture, vUv).rgb * 0.2 * weight;

        // 9-tap bilinear filter
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
