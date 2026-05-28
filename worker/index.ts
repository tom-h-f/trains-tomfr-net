import type { Env } from './train-hub'

export { TrainHub } from './train-hub'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return env.TRAIN_HUB.getByName('global').fetch(request)
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      env.TRAIN_HUB.getByName('global')
        .fetch('http://durable-object/cron')
        .then((res) => {
          if (!res.ok) {
            console.error('DO cron call failed:', res.status)
          }
        })
        .catch((err) => {
          console.error('DO cron call errored:', err)
        })
    )
  },
}
