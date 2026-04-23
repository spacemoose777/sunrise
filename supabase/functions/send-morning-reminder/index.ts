// Sunrise — Morning Reminder + Mood Check-in Edge Function
// Runs every 15 minutes. Sends push notifications to users where it is currently
// their chosen reminder time (or random mood check-in time) in their local timezone.
//
// Modes (via query param):
//   ?test=true      — skip time check for morning reminder, send immediately
//   ?testMood=true  — skip time check for mood check-in, send immediately
//   ?debug=true     — return timing diagnostics without sending anything

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const MORNING_MESSAGES = [
  'Good morning ☀️ Time for your daily reflection.',
  'Rise and reflect 🌅 Your journal is waiting.',
  'A new day begins. What are you grateful for? 🌿',
  'Morning! Take a moment to set your intention for today.',
  'Good morning. A few mindful minutes can shape your whole day. ✨',
]

const MOOD_MESSAGES = [
  'How are you feeling right now? 💭',
  'Take a moment to check in — how\'s your mood? 🌿',
  'A quick mood check-in 🌈 How are you doing?',
  'Pause and reflect — how are you feeling? ✨',
  'How\'s your day going? Log your mood in Sunrise. ☀️',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

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

function getLocalDate(date: Date, tz: string): string {
  // Returns "YYYY-MM-DD" in the given timezone (en-CA locale reliably gives this format)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

Deno.serve(async (req: Request) => {
  const url          = new URL(req.url)
  const testMode     = url.searchParams.get('test')      === 'true'
  const testMoodMode = url.searchParams.get('testMood')  === 'true'
  const debugMode    = url.searchParams.get('debug')     === 'true'

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
    .select(`
      id, subscription, timezone, notification_hour,
      mood_prompt_enabled, mood_prompt_start, mood_prompt_end,
      mood_prompt_today_mins, mood_prompt_today_date, mood_prompt_last_sent
    `)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const now    = new Date()
  const nowUtc = now.toISOString()
  let sent     = 0
  let moodSent = 0
  const expired: string[]     = []
  const diagnostics: object[] = []

  for (const sub of subs ?? []) {
    const tz       = sub.timezone         ?? 'Pacific/Auckland'
    const rawValue = sub.notification_hour ?? 420
    // Backward compat: rows written before minutes format stored 0–23 as bare hour
    const targetMins = rawValue <= 23 ? rawValue * 60 : rawValue
    const localMins  = getLocalMins(now, tz)
    const localDate  = getLocalDate(now, tz)
    const timeMatch  = localMins === targetMins

    const localTimeStr  = `${String(Math.floor(localMins / 60)).padStart(2,'0')}:${String(localMins % 60).padStart(2,'0')}`
    const targetTimeStr = `${String(Math.floor(targetMins / 60)).padStart(2,'0')}:${String(targetMins % 60).padStart(2,'0')}`

    // ── Mood prompt scheduling ────────────────────────────────────────────
    let moodTodayMins: number | null = sub.mood_prompt_today_mins ?? null
    let moodScheduled = false

    if (sub.mood_prompt_enabled) {
      const startMins = (sub.mood_prompt_start ?? 9) * 60
      const endMins   = (sub.mood_prompt_end   ?? 21) * 60

      // If we haven't picked a random time for today yet, pick one now
      if (sub.mood_prompt_today_date !== localDate && startMins < endMins) {
        const slots     = Math.floor((endMins - startMins) / 15)
        moodTodayMins   = startMins + Math.floor(Math.random() * slots) * 15
        moodScheduled   = true

        if (!debugMode) {
          await supabase
            .from('push_subscriptions')
            .update({ mood_prompt_today_mins: moodTodayMins, mood_prompt_today_date: localDate })
            .eq('id', sub.id)
        }
      }
    }

    const moodTimeStr = moodTodayMins !== null
      ? `${String(Math.floor(moodTodayMins / 60)).padStart(2,'0')}:${String(moodTodayMins % 60).padStart(2,'0')}`
      : null

    const moodTimeMatch = moodTodayMins !== null && localMins === moodTodayMins
    const moodAlreadySent = sub.mood_prompt_last_sent === localDate
    const willSendMood = sub.mood_prompt_enabled && (testMoodMode || (moodTimeMatch && !moodAlreadySent))

    diagnostics.push({
      id: sub.id,
      tz,
      localTime: localTimeStr,
      localDate,
      targetTime: targetTimeStr,
      rawNotificationHour: rawValue,
      timeMatch,
      willSend: testMode || timeMatch,
      moodPromptEnabled: sub.mood_prompt_enabled ?? false,
      moodTodayTime: moodTimeStr,
      moodScheduledNow: moodScheduled,
      moodAlreadySent,
      moodTimeMatch,
      willSendMood,
    })

    if (debugMode) continue

    // ── Morning reminder ──────────────────────────────────────────────────
    if (testMode || timeMatch) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({ title: 'Sunrise', body: pick(MORNING_MESSAGES) })
        )
        sent++
      } catch (err: unknown) {
        const status  = (err as { statusCode?: number }).statusCode
        const message = (err as { message?:    string }).message ?? 'unknown'
        console.error(`Morning push failed for ${sub.id}: HTTP ${status} — ${message}`)
        if (status === 410 || status === 404) expired.push(sub.id)
      }
    }

    // ── Mood check-in ─────────────────────────────────────────────────────
    if (willSendMood) {
      try {
        await webpush.sendNotification(
          sub.subscription,
          JSON.stringify({ title: 'Sunrise', body: pick(MOOD_MESSAGES) })
        )
        moodSent++
        await supabase
          .from('push_subscriptions')
          .update({ mood_prompt_last_sent: localDate })
          .eq('id', sub.id)
      } catch (err: unknown) {
        const status  = (err as { statusCode?: number }).statusCode
        const message = (err as { message?:    string }).message ?? 'unknown'
        console.error(`Mood push failed for ${sub.id}: HTTP ${status} — ${message}`)
        if (status === 410 || status === 404) {
          if (!expired.includes(sub.id)) expired.push(sub.id)
        }
      }
    }
  }

  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return new Response(
    JSON.stringify({ nowUtc, sent, moodSent, expired: expired.length, checked: subs?.length ?? 0, testMode, testMoodMode, debugMode, diagnostics }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
