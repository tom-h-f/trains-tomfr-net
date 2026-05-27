import type { TrainRegistry } from './services/train-registry'

declare global {
  // eslint-disable-next-line no-var
  var trainRegistry: TrainRegistry | undefined
}

export function getRegistry(): TrainRegistry | null {
  return global.trainRegistry ?? null
}

export function setRegistry(r: TrainRegistry) {
  global.trainRegistry = r
}
