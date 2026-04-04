// Sunrise — Morning Reminder Edge Function
// Runs every hour. Sends a push notification to users where it is currently 7am local time.

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
  const supabaseUrl      = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const vapidPublicKey   = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey  = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidEmail       = Deno.env.get('VAPID_EMAIL')!

  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Fetch all subscriptions joined with each user's timezone setting
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription, user_profiles(settings)')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const now = new Date()
  let sent = 0
  const expired: string[] = []

  for (const sub of subs ?? []) {
    const settings = (sub.user_profiles as { settings?: { timezone?: string } } | null)?.settings
    const tz = settings?.timezone ?? 'Pacific/Auckland'

    // Only send if it's currently 7am in the user's timezone
    const localHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now)
    )
    if (localHour !== 7) continue

    const body = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title: 'Sunrise', body })
      )
      sent++
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      // 410 Gone or 404 Not Found means the subscription is no longer valid
      if (status === 410 || status === 404) {
        expired.push(sub.id)
      }
    }
  }

  // Remove any expired subscriptions
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return new Response(JSON.stringify({ sent, expired: expired.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
