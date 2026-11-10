export {
  compileMaterial,
  convert,
  glslFloat,
  type CompiledMaterial,
  type MaterialProblem,
  type MaterialProblemCode,
} from './compile.ts';
export {
  availableIn,
  HELPERS,
  NODES,
  nodeInputs,
  outputInputs,
  UNIFORMS,
  type InputPort,
  type InputType,
  type NodeSpec,
  type OutputPort,
  type PortType,
  type Rate,
} from './nodes.ts';
export { materialTemplate } from './templates.ts';
