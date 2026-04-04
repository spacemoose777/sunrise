// Sunrise — Morning Reminder Edge Function
// Runs every 15 minutes. Sends push notifications to users where it is currently
// their chosen reminder time in their local timezone.
//
// Modes (via query param):
//   ?test=true   — skip time check, send immediately
//   ?debug=true  — return timing diagnostics without sending anything

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const MESSAGES = [
  'Good morning ☀️ Time for your daily reflection.',
  'Rise and reflect 🌅 Your journal is waiting.',
  'A new day begins. What are you grateful for? 🌿',
  'Morning! Take a moment to set your intention for today.',
  'Good morning. A few mindful minutes can shape your whole day. ✨',
]

function getLocalMins(date: Date, tz: string): number {
  // Format as "HH:MM" in the given timezone using en-GB (always 24h, no AM/PM)
  const str = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)  // e.g. "07:30"
  const [h, m] = str.split(':').map(Number)
  return ((h % 24) * 60) + m
}

Deno.serve(async (req: Request) => {
  const url       = new URL(req.url)
  const testMode  = url.searchParams.get('test')  === 'true'
  const debugMode = url.searchParams.get('debug') === 'true'

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidEmail      = Deno.env.get('VAPID_EMAIL')!

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    return new Response(JSON.stringify({ error: 'Missing VAPID secrets' }), { status: 500 })
  }

  if (!debugMode) {
    webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription, timezone, notification_hour')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const now     = new Date()
  const nowUtc  = now.toISOString()
  let sent      = 0
  const expired: string[]     = []
  const diagnostics: object[] = []

  for (const sub of subs ?? []) {
    const tz        = sub.timezone         ?? 'Pacific/Auckland'
    const rawValue  = sub.notification_hour ?? 420
    // Backward compat: rows written before minutes format stored 0–23 as bare hour
    const targetMins = rawValue <= 23 ? rawValue * 60 : rawValue
    const localMins  = getLocalMins(now, tz)
    const timeMatch  = localMins === targetMins

    const localTimeStr = `${String(Math.floor(localMins / 60)).padStart(2,'0')}:${String(localMins % 60).padStart(2,'0')}`
    const targetTimeStr = `${String(Math.floor(targetMins / 60)).padStart(2,'0')}:${String(targetMins % 60).padStart(2,'0')}`

    diagnostics.push({
      id: sub.id,
      tz,
      localTime: localTimeStr,
      targetTime: targetTimeStr,
      rawNotificationHour: rawValue,
      timeMatch,
      willSend: testMode || timeMatch,
    })

    if (!testMode && !timeMatch) continue
    if (debugMode) continue  // debug mode: report without sending

    const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title: 'Sunrise', body })
      )
      sent++
    } catch (err: unknown) {
      const status  = (err as { statusCode?: number }).statusCode
      const message = (err as { message?:    string }).message ?? 'unknown'
      console.error(`Push failed for ${sub.id}: HTTP ${status} — ${message}`)
      if (status === 410 || status === 404) expired.push(sub.id)
    }
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return new Response(
    JSON.stringify({ nowUtc, sent, expired: expired.length, checked: subs?.length ?? 0, testMode, debugMode, diagnostics }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
