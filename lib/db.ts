import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// max: 1 is critical for Vercel serverless — each function instance
// handles one request at a time; a larger pool wastes connections.
// ssl: 'require' is required by Supabase.
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: 'require',
})

export default sql
