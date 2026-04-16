// Server Component wrapper — `connection()` opts this route out of build-time
// prerendering. The actual UI lives in `./client.tsx` (a Client Component).
import { connection } from 'next/server'
import DashboardClient from './client'

export default async function DashboardPage() {
  await connection()
  return <DashboardClient />
}
