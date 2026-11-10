import { UNIFORMS, type CompiledMaterial } from '@ie/material';

/*
 * Programs for materials (ADR 0020): the stage's own sprite and overlay shaders with a material's
 * generated chunks dropped in. Text materials keep the sprite instance layout, so a material title
 * is the same buffer drawn with another program; post materials are one more full-screen pass.
 * Material fragments use highp: mediump is 16-bit on the Adreno 610, and time and beat counts
 * would lose their fractions within minutes.
 */

export const MATERIAL_PARAMS = 8;

const UNIFORM_DECLS = `uniform float ${UNIFORMS.time};
uniform float ${UNIFORMS.beat};
uniform float ${UNIFORMS.beatPhase};
uniform float ${UNIFORMS.barPhase};
uniform float ${UNIFORMS.pulse};
uniform float ${UNIFORMS.aspect};
uniform float ${UNIFORMS.glyphCount};
uniform float ${UNIFORMS.params}[${MATERIAL_PARAMS}];`;

export function textMaterialShaders(m: CompiledMaterial): { vs: string; fs: string } {
  const vs = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_center;
layout(location = 1) in vec2 a_half;
layout(location = 2) in float a_angle;
layout(location = 3) in vec4 a_uv;
layout(location = 4) in vec4 a_color;
layout(location = 5) in vec4 a_params;
uniform vec2 u_view;
uniform vec4 u_camera;
${UNIFORM_DECLS}
out vec2 v_uv;
out vec2 v_local;
out vec4 v_color;
out vec4 v_params;
${m.helpers}
void main() {
  vec2 m_offset = vec2(0.0);
${m.vertex}
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  v_local = corner * 2.0 - 1.0;
  v_uv = mix(a_uv.xy, a_uv.zw, corner);
  v_color = a_color;
  v_params = a_params;
  float c = cos(a_angle), s = sin(a_angle);
  vec2 p = v_local * a_half;
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + a_center + m_offset;
  vec2 mid = u_view * 0.5;
  vec2 q = (p - mid) * (1.0 + u_camera.w);
  float cc = cos(u_camera.z), ss = sin(u_camera.z);
  q = vec2(q.x * cc - q.y * ss, q.x * ss + q.y * cc) + mid + u_camera.xy;
  vec2 clip = q / u_view * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;
  const fs = `#version 300 es
precision highp float;
uniform sampler2D u_atlas;
${UNIFORM_DECLS}
in vec2 v_uv;
in vec2 v_local;
in vec4 v_color;
in vec4 v_params;
out vec4 outColor;
const float EDGE = 0.75;
${m.helpers}
void main() {
  float d = texture(u_atlas, v_uv).r;
  float w = max(fwidth(d) * 0.75, 0.004);
  float m_shape = smoothstep(EDGE - w, EDGE + w, d);
  vec2 m_uv = v_local * 0.5 + 0.5;
  vec3 m_color = v_color.rgb;
  float m_alpha = m_shape;
${m.fragment}
  float a = clamp(m_alpha, 0.0, 1.0) * v_color.a;
  outColor = vec4(clamp(m_color, 0.0, 1.0) * a, a);
}`;
  return { vs, fs };
}

export function postMaterialShaders(m: CompiledMaterial): { vs: string; fs: string } {
  const vs = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  v_uv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;
  const fs = `#version 300 es
precision highp float;
${UNIFORM_DECLS}
in vec2 v_uv;
out vec4 outColor;
${m.helpers}
void main() {
  // UV runs down the screen, as text does, so (0, 0) is the top-left corner.
  vec2 m_uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 m_color = vec3(1.0);
  float m_alpha = 1.0;
${m.fragment}
  float a = clamp(m_alpha, 0.0, 1.0);
  outColor = vec4(clamp(m_color, 0.0, 1.0) * a, a);
}`;
  return { vs, fs };
}
