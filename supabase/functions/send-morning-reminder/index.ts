// Sunrise — Morning Reminder Edge Function
// Runs every hour. Sends push notifications to users where it is currently
// their chosen reminder hour in their local timezone.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const MESSAGES = [
  'Good morning ☀️ Time for your daily reflection.',
  'Rise and reflect 🌅 Your journal is waiting.',
  'A new day begins. What are you grateful for? 🌿',
  'Morning! Take a moment to set your intention for today.',
  'Good morning. A few mindful minutes can shape your whole day. ✨',
]

Deno.serve(async () => {
  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidEmail      = Deno.env.get('VAPID_EMAIL')!

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // timezone and notification_hour are stored directly on the row — no join needed
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription, timezone, notification_hour')

  if (error) {
    console.error('Failed to fetch subscriptions:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const now = new Date()
  let sent = 0
  const expired: string[] = []

  for (const sub of subs ?? []) {
    const tz          = sub.timezone          ?? 'Pacific/Auckland'
    const targetMins  = sub.notification_hour ?? 420  // stored as minutes since midnight; default 7:00am

    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false })
    const parts = fmt.formatToParts(now)
    const localH = parseInt(parts.find(p => p.type === 'hour')!.value)
    const localM = parseInt(parts.find(p => p.type === 'minute')!.value)
    const localMins = localH * 60 + localM

    if (localMins !== targetMins) continue

    const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title: 'Sunrise', body })
      )
      sent++
      console.log(`Sent to subscription ${sub.id} (${tz} hour ${targetHour})`)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      console.error(`Failed for ${sub.id}: status ${status}`)
      if (status === 410 || status === 404) expired.push(sub.id)
    }
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
    console.log(`Removed ${expired.length} expired subscriptions`)
  }

  return new Response(JSON.stringify({ sent, expired: expired.length, checked: subs?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
