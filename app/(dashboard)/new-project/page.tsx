// Server Component wrapper — calls connection() to opt this route out of
// build-time prerendering. The actual UI lives in `./client.tsx` (a Client
// Component) which uses useSearchParams and other browser-only APIs.
//
// Without this, Next.js tries to statically prerender the page during
// `next build` (because every leaf is a Client Component), which can crash
// inside the (dashboard) layout on Vercel.
import { connection } from 'next/server'
import NewProjectClient from './client'

export default async function NewProjectPage() {
  await connection()
  return <NewProjectClient />
}
