# Separate marketplace order alarms

Uber Eats and DoorDash each get their own device-local enabled switch, sound picker, play count (1–10), and preview in Register settings. Existing online/scheduled order sound preferences retain their values and behaviour. Use the existing bundled sounds and settings persistence/backup mechanism. New provider settings default enabled with the existing default sound and three plays; staff can disable each independently.

Reuse the existing realtime order subscription and route marketplace orders using their stored partner/payment source. Do not tie sounds to printing, printer ownership, or online sound enablement. Keep per-order deduplication. Serialize audio sequences so overlapping arrivals do not get dropped. Unknown third-party sources do not inherit an unrelated provider's settings. No background notification entitlement or server changes are included.

A combined marketplace control was considered; the user chose independent Uber Eats and DoorDash controls. Separate subscriptions/audio players were rejected because they could duplicate events or overlap audio. Keep the existing subscription and one queued player.

Validate source routing, independent switches/choices, legacy settings defaults, invalid saved values, realtime wiring, and overlapping/failing audio playback in isolated tests. Inspect settings in the simulator without saving settings, creating orders, or invoking payment/print actions.
