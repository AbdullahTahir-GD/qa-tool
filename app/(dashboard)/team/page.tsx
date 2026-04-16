// Server Component wrapper — `connection()` opts this route out of build-time
// prerendering. The actual UI lives in `./client.tsx` (a Client Component
// that uses useSearchParams, etc.).
import { connection } from 'next/server'
import TeamClient from './client'

export default async function TeamPage() {
  await connection()
  return <TeamClient />
}
