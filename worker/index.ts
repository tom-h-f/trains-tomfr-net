import type { Env } from './train-hub'

export { TrainHub } from './train-hub'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.TRAIN_HUB.getByName('global').fetch(request)
  },
}
