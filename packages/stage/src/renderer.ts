import type { CompiledMaterial } from '@ie/material';
import type { GlyphAtlas } from './atlas.ts';
import { MATERIAL_PARAMS, postMaterialShaders, textMaterialShaders } from './material-shaders.ts';
import { OVERLAY_FS, OVERLAY_VS, SPRITE_FS, SPRITE_VS } from './shaders.ts';

/** Floats per sprite instance: centre 2, half-size 2, angle 1, uv 4, colour 4, params 4. */
export const SPRITE_FLOATS = 17;

export const SHAPE = { glyph: 0, disc: 1, ring: 2, slash: 3, rect: 4 } as const;

export interface OverlayUniforms {
  readonly flash: readonly [number, number, number, number];
  readonly tint: readonly [number, number, number, number];
  readonly vignette: number;
  readonly grain: number;
  readonly scanlines: number;
  readonly cover: readonly [number, number, number, number];
  readonly coverKind: number;
}

/** What a material reads each frame besides its parameters (ADR 0020). */
export interface MaterialFrame {
  readonly time: number;
  readonly beat: number;
  readonly beatPhase: number;
  readonly barPhase: number;
  readonly pulse: number;
}

export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly zoom: number;
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost())
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost())
    throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  return program;
}

/**
 * The GPU side of the stage on WebGL2 (the baseline, ADR 0006). It owns GL objects only; the
 * stage fills the instance array. Everything here is re-creatable after a lost context.
 */
export class Renderer {
  private sprite!: WebGLProgram;
  private overlay!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private empty!: WebGLVertexArrayObject;
  private buffer!: WebGLBuffer;
  private texture!: WebGLTexture;
  private capacity = 0;
  private atlasVersion = -1;
  private atlasHeight = 0;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly materialUniforms = new WeakMap<
    WebGLProgram,
    Map<string, WebGLUniformLocation | null>
  >();
  /** One program per generated source; null for a material that failed to build. */
  private readonly materials = new Map<string, WebGLProgram | null>();
  drawCalls = 0;

  constructor(readonly gl: WebGL2RenderingContext) {
    this.init();
  }

  /** (Re)creates programs, buffers and the texture; called again after a context restore. */
  init(): void {
    const { gl } = this;
    this.sprite = compile(gl, SPRITE_VS, SPRITE_FS);
    this.overlay = compile(gl, OVERLAY_VS, OVERLAY_FS);
    this.uniforms.clear();
    this.materials.clear();
    this.buffer = gl.createBuffer();
    this.vao = gl.createVertexArray();
    this.empty = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const stride = SPRITE_FLOATS * 4;
    const attrs: [number, number, number][] = [
      [0, 2, 0],
      [1, 2, 2],
      [2, 1, 4],
      [3, 4, 5],
      [4, 4, 9],
      [5, 4, 13],
    ];
    for (const [loc, size, offset] of attrs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    this.capacity = 0;
    this.texture = gl.createTexture();
    this.atlasVersion = -1;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  private uniform(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    const key = `${program === this.sprite ? 's' : 'o'}:${name}`;
    if (!this.uniforms.has(key)) this.uniforms.set(key, this.gl.getUniformLocation(program, name));
    return this.uniforms.get(key) ?? null;
  }

  /**
   * The program for a compiled material, built the first time its source is seen. A driver that
   * rejects it gets null, and the stage draws without the material (ADR 0020).
   */
  materialProgram(material: CompiledMaterial): WebGLProgram | null {
    const cached = this.materials.get(material.key);
    if (cached !== undefined) return cached;
    let program: WebGLProgram | null = null;
    try {
      const { vs, fs } =
        material.domain === 'text' ? textMaterialShaders(material) : postMaterialShaders(material);
      program = compile(this.gl, vs, fs);
    } catch (error) {
      console.warn(`The material "${material.id}" could not be built.`, error);
    }
    this.materials.set(material.key, program);
    return program;
  }

  private materialUniform(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    let map = this.materialUniforms.get(program);
    if (!map) {
      map = new Map();
      this.materialUniforms.set(program, map);
    }
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(program, name));
    return map.get(name) ?? null;
  }

  private setMaterialUniforms(
    program: WebGLProgram,
    frame: MaterialFrame,
    params: Float32Array,
    aspect: number,
    glyphCount: number,
  ): void {
    const { gl } = this;
    gl.uniform1f(this.materialUniform(program, 'u_time'), frame.time);
    gl.uniform1f(this.materialUniform(program, 'u_beat'), frame.beat);
    gl.uniform1f(this.materialUniform(program, 'u_beatPhase'), frame.beatPhase);
    gl.uniform1f(this.materialUniform(program, 'u_barPhase'), frame.barPhase);
    gl.uniform1f(this.materialUniform(program, 'u_pulse'), frame.pulse);
    gl.uniform1f(this.materialUniform(program, 'u_aspect'), aspect);
    gl.uniform1f(this.materialUniform(program, 'u_glyphCount'), glyphCount);
    gl.uniform1fv(this.materialUniform(program, 'u_params[0]'), params, 0, MATERIAL_PARAMS);
  }

  /** Uploads the atlas when it changed (new letters, or a fresh context). */
  syncAtlas(atlas: GlyphAtlas): void {
    if (atlas.version === this.atlasVersion && atlas.height === this.atlasHeight) return;
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      atlas.width,
      atlas.height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      atlas.pixels,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlasVersion = atlas.version;
    this.atlasHeight = atlas.height;
  }

  begin(width: number, height: number): void {
    const { gl } = this;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.drawCalls = 0;
  }

  /** One instanced draw of `count` sprites from `data`. */
  sprites(
    data: Float32Array,
    count: number,
    view: { w: number; h: number },
    camera: Camera,
    aberration: number,
  ): void {
    if (count === 0) return;
    const { gl } = this;
    gl.useProgram(this.sprite);
    this.upload(data, count);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniform(this.sprite, 'u_atlas'), 0);
    gl.uniform2f(this.uniform(this.sprite, 'u_view'), view.w, view.h);
    gl.uniform4f(
      this.uniform(this.sprite, 'u_camera'),
      camera.x,
      camera.y,
      camera.angle,
      camera.zoom,
    );
    gl.uniform1f(this.uniform(this.sprite, 'u_aberration'), aberration);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
    this.drawCalls++;
  }

  private upload(data: Float32Array, count: number): void {
    const { gl } = this;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    if (count > this.capacity) {
      this.capacity = Math.max(count, this.capacity * 2, 256);
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity * SPRITE_FLOATS * 4, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * SPRITE_FLOATS));
  }

  /** One instanced draw of a material title's glyphs (the sprite layout, another program). */
  materialSprites(
    program: WebGLProgram,
    data: Float32Array,
    count: number,
    view: { w: number; h: number },
    camera: Camera,
    frame: MaterialFrame,
    params: Float32Array,
  ): void {
    if (count === 0) return;
    const { gl } = this;
    gl.useProgram(program);
    this.upload(data, count);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.materialUniform(program, 'u_atlas'), 0);
    gl.uniform2f(this.materialUniform(program, 'u_view'), view.w, view.h);
    gl.uniform4f(
      this.materialUniform(program, 'u_camera'),
      camera.x,
      camera.y,
      camera.angle,
      camera.zoom,
    );
    this.setMaterialUniforms(program, frame, params, view.w / view.h, count);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
    this.drawCalls++;
  }

  /** The post material over the whole screen. */
  materialPass(
    program: WebGLProgram,
    size: { w: number; h: number },
    frame: MaterialFrame,
    params: Float32Array,
  ): void {
    const { gl } = this;
    gl.useProgram(program);
    gl.bindVertexArray(this.empty);
    this.setMaterialUniforms(program, frame, params, size.w / size.h, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    this.drawCalls++;
  }

  overlayPass(u: OverlayUniforms, size: { w: number; h: number }, time: number): void {
    const visible =
      u.flash[3] > 0 ||
      u.tint[3] > 0 ||
      u.vignette > 0 ||
      u.grain > 0 ||
      u.scanlines > 0 ||
      u.coverKind > 0;
    if (!visible) return;
    const { gl } = this;
    const p = this.overlay;
    gl.useProgram(p);
    gl.bindVertexArray(this.empty);
    gl.uniform2f(this.uniform(p, 'u_resolution'), size.w, size.h);
    gl.uniform1f(this.uniform(p, 'u_time'), time);
    gl.uniform4f(this.uniform(p, 'u_flash'), ...u.flash);
    gl.uniform4f(this.uniform(p, 'u_tint'), ...u.tint);
    gl.uniform1f(this.uniform(p, 'u_vignette'), u.vignette);
    gl.uniform1f(this.uniform(p, 'u_grain'), u.grain);
    gl.uniform1f(this.uniform(p, 'u_scanlines'), u.scanlines);
    gl.uniform4f(this.uniform(p, 'u_cover'), ...u.cover);
    gl.uniform1f(this.uniform(p, 'u_coverKind'), u.coverKind);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    this.drawCalls++;
  }
}
