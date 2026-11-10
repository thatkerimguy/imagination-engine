/*
 * Two programs draw the whole stage: one instanced draw for every glyph, icon, shape and particle,
 * and one full-screen pass for the overlay (vignette, grain, scanlines, tint, flash and
 * transitions). No render targets: on the Adreno 610 a second full-resolution pass is the most
 * expensive thing the stage could do.
 */

export const SPRITE_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_center;
layout(location = 1) in vec2 a_half;
layout(location = 2) in float a_angle;
layout(location = 3) in vec4 a_uv;
layout(location = 4) in vec4 a_color;
layout(location = 5) in vec4 a_params;
uniform vec2 u_view;      // CSS px
uniform vec4 u_camera;    // offset x, offset y, angle, zoom
out vec2 v_uv;
out vec2 v_local;
out vec4 v_color;
out vec4 v_params;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  v_local = corner * 2.0 - 1.0;
  v_uv = mix(a_uv.xy, a_uv.zw, corner);
  v_color = a_color;
  v_params = a_params;
  float c = cos(a_angle), s = sin(a_angle);
  vec2 p = v_local * a_half;
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + a_center;
  // Camera: shake offset, a small roll and zoom about the centre.
  vec2 mid = u_view * 0.5;
  vec2 q = (p - mid) * (1.0 + u_camera.w);
  float cc = cos(u_camera.z), ss = sin(u_camera.z);
  q = vec2(q.x * cc - q.y * ss, q.x * ss + q.y * cc) + mid + u_camera.xy;
  vec2 clip = q / u_view * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

export const SPRITE_FS = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D u_atlas;
uniform float u_aberration;
in vec2 v_uv;
in vec2 v_local;
in vec4 v_color;
in vec4 v_params; // kind, thickness, glow, unused
out vec4 outColor;
const float EDGE = 0.75; // the atlas puts the outline at 255 * (1 - 0.25)

float glyphAlpha(vec2 uv) {
  float d = texture(u_atlas, uv).r;
  float w = max(fwidth(d) * 0.75, 0.004);
  return smoothstep(EDGE - w, EDGE + w, d);
}

void main() {
  float kind = v_params.x;
  float alpha;
  if (kind < 0.5) {
    alpha = glyphAlpha(v_uv);
    if (v_params.z > 0.0) {
      float d = texture(u_atlas, v_uv).r;
      alpha = max(alpha, smoothstep(EDGE - 0.35, EDGE, d) * v_params.z);
    }
    if (u_aberration > 0.0) {
      // Red and blue fringes: two more taps per pixel, glyphs only.
      vec2 shift = vec2(u_aberration * fwidth(v_uv.x) * 6.0, 0.0);
      float r = glyphAlpha(v_uv - shift);
      float b = glyphAlpha(v_uv + shift);
      vec3 rgb = v_color.rgb * alpha;
      rgb.r = max(rgb.r, r * 0.9);
      rgb.b = max(rgb.b, b * 0.9);
      float a = max(alpha, max(r, b)) * v_color.a;
      outColor = vec4(rgb * v_color.a, a);
      return;
    }
  } else {
    float r = length(v_local);
    float aa = fwidth(r) * 1.5;
    if (kind < 1.5) {        // disc
      alpha = 1.0 - smoothstep(1.0 - aa, 1.0, r);
    } else if (kind < 2.5) { // ring
      float t = v_params.y;
      alpha = 1.0 - smoothstep(t - aa, t, abs(r - (1.0 - t)));
    } else if (kind < 3.5) { // slash: a bar with soft ends
      float y = abs(v_local.y);
      float x = abs(v_local.x);
      float aay = fwidth(v_local.y) * 1.5;
      alpha = (1.0 - smoothstep(1.0 - aay, 1.0, y)) * (1.0 - smoothstep(0.7, 1.0, x));
    } else {                 // solid rectangle
      alpha = 1.0;
    }
  }
  float a = alpha * v_color.a;
  outColor = vec4(v_color.rgb * a, a); // premultiplied
}`;

export const OVERLAY_VS = /* glsl */ `#version 300 es
out vec2 v_uv;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  v_uv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

export const OVERLAY_FS = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform vec2 u_resolution;  // device px
uniform float u_time;
uniform vec4 u_flash;       // rgb, amount
uniform vec4 u_tint;        // rgb, amount
uniform float u_vignette;
uniform float u_grain;
uniform float u_scanlines;
uniform vec4 u_cover;       // rgb of the transition cover, progress 0..1
uniform float u_coverKind;  // 0 none, 1 noise dissolve, 2 ink spread, 3 wipe
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec3 rgb = vec3(0.0);
  float a = 0.0;
  // Layers composite back to front, all premultiplied.
  if (u_vignette > 0.0) {
    vec2 d = v_uv - 0.5;
    float v = smoothstep(0.25, 0.75, length(d * vec2(u_resolution.x / u_resolution.y, 1.0)));
    a = v * u_vignette;
  }
  if (u_tint.a > 0.0) {
    rgb = rgb * (1.0 - u_tint.a) + u_tint.rgb * u_tint.a;
    a = a + u_tint.a * (1.0 - a);
  }
  if (u_scanlines > 0.0) {
    float line = step(0.5, fract(gl_FragCoord.y / 3.0));
    a = a + line * u_scanlines * (1.0 - a);
  }
  if (u_grain > 0.0) {
    float g = hash(gl_FragCoord.xy + fract(u_time * 7.0) * 100.0);
    rgb = rgb + vec3(g) * u_grain * 0.5;
    a = a + u_grain * 0.5 * (1.0 - a);
  }
  if (u_coverKind > 0.5) {
    float p = u_cover.a;
    float m;
    if (u_coverKind < 1.5) {
      m = step(noise(gl_FragCoord.xy / 18.0) * 0.9 + 0.05, p);
    } else if (u_coverKind < 2.5) {
      vec2 d = (v_uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
      float r = length(d) + noise(gl_FragCoord.xy / 40.0) * 0.25;
      m = step(r, p * 1.2);
    } else {
      m = step(v_uv.x + noise(vec2(0.0, gl_FragCoord.y / 30.0)) * 0.1, p * 1.1);
    }
    rgb = mix(rgb, u_cover.rgb, m);
    a = mix(a, 1.0, m);
  }
  if (u_flash.a > 0.0) {
    rgb = rgb * (1.0 - u_flash.a) + u_flash.rgb * u_flash.a;
    a = a + u_flash.a * (1.0 - a);
  }
  outColor = vec4(rgb, a);
}`;
