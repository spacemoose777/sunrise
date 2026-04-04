// Sunrise — Morning Reminder Edge Function
// Runs every 15 minutes. Sends push notifications to users where it is currently
// their chosen reminder time in their local timezone.
//
// Test mode: call with ?test=true to skip the time check and send immediately.
// e.g. curl -X POST "https://...supabase.co/functions/v1/send-morning-reminder?test=true" \
//      -H "Authorization: Bearer ANON_KEY"

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const MESSAGES = [
  'Good morning ☀️ Time for your daily reflection.',
  'Rise and reflect 🌅 Your journal is waiting.',
  'A new day begins. What are you grateful for? 🌿',
  'Morning! Take a moment to set your intention for today.',
  'Good morning. A few mindful minutes can shape your whole day. ✨',
]

Deno.serve(async (req: Request) => {
  const url       = new URL(req.url)
  const testMode  = url.searchParams.get('test') === 'true'

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidEmail      = Deno.env.get('VAPID_EMAIL')!

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    console.error('Missing VAPID secrets — check Supabase project secrets')
    return new Response(JSON.stringify({ error: 'Missing VAPID configuration' }), { status: 500 })
  }

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription, timezone, notification_hour')

  if (error) {
    console.error('Failed to fetch subscriptions:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`Found ${subs?.length ?? 0} subscription(s). Test mode: ${testMode}`)

  const now = new Date()
  let sent = 0
  const expired: string[] = []
  const skipped: string[] = []

  for (const sub of subs ?? []) {
    const tz         = sub.timezone          ?? 'Pacific/Auckland'
    const rawValue   = sub.notification_hour ?? 420
    // Backward compat: old rows stored 0–23 as hour; new rows store minutes since midnight
    const targetMins = rawValue <= 23 ? rawValue * 60 : rawValue

    if (!testMode) {
      const fmt   = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false })
      const parts = fmt.formatToParts(now)
      const localH    = parseInt(parts.find(p => p.type === 'hour')!.value)
      const localM    = parseInt(parts.find(p => p.type === 'minute')!.value)
      const localMins = localH * 60 + localM

      if (localMins !== targetMins) {
        skipped.push(`${sub.id} (localMins=${localMins} targetMins=${targetMins} tz=${tz})`)
        continue
      }
    }

    const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title: 'Sunrise', body })
      )
      sent++
      console.log(`✓ Sent to ${sub.id} (tz=${tz}, targetMins=${targetMins})`)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      const message = (err as { message?: string }).message ?? 'unknown'
      console.error(`✗ Failed for ${sub.id}: HTTP ${status} — ${message}`)
      if (status === 410 || status === 404) expired.push(sub.id)
    }
  }

  if (skipped.length > 0) {
    console.log(`Skipped (wrong time): ${skipped.join(', ')}`)
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
    console.log(`Removed ${expired.length} expired subscription(s)`)
  }

  return new Response(
    JSON.stringify({ sent, expired: expired.length, checked: subs?.length ?? 0, testMode }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
