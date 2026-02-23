import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Lazily initialize the postgres client — the constructor parses the URL
// synchronously, and Next.js evaluates server modules during the build step.
// Deferring to first use means a misconfigured DATABASE_URL causes a runtime
// error (visible in logs) rather than a build failure.
let _sql: ReturnType<typeof postgres> | undefined

function init() {
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL!, {
      max: 1,       // one connection per serverless function instance
      ssl: 'require',
    })
  }
  return _sql
}

// Proxy so all call sites use sql`...` and sql.begin() unchanged.
const sql = new Proxy(
  function () {} as unknown as ReturnType<typeof postgres>,
  {
    apply(_target, _thisArg, args) {
      return (init() as unknown as Function)(...args)
    },
    get(_target, prop: string | symbol) {
      const client = init()
      const value = (client as any)[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
)

export default sql
