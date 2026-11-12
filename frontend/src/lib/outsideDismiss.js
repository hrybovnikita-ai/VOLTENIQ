// Close a popup when the user presses outside it, without ever closing it
// because of a press *inside* it.
//
// The old account menu was a <details> that closed on blur. iOS WebKit (Safari,
// Telegram, every iOS browser) and desktop Safari do not focus a <button> when
// it is tapped/clicked, so blur fired with relatedTarget = null, the menu
// collapsed on touchstart/mousedown, and the Sign Out click landed on nothing.
// Containment of the press target is reliable on every engine.

function pressEvents(win) {
  if (win && typeof win.PointerEvent === 'function') return ['pointerdown']
  return ['touchstart', 'mousedown']
}

/**
 * @param {object} options
 * @param {EventTarget} options.doc document (or any EventTarget)
 * @param {(target: unknown) => boolean} options.isInside
 * @param {() => void} options.onDismiss
 * @param {() => void} [options.onEscape] defaults to onDismiss
 * @param {object} [options.win] window, used to detect Pointer Events
 * @returns {() => void} detach
 */
export function attachOutsideDismiss({ doc, isInside, onDismiss, onEscape = onDismiss, win }) {
  const events = pressEvents(win ?? (typeof window !== 'undefined' ? window : undefined))
  const onPress = (event) => {
    if (!isInside(event.target)) onDismiss()
  }
  const onKey = (event) => {
    if (event.key === 'Escape') onEscape()
  }
  for (const name of events) doc.addEventListener(name, onPress, { passive: true })
  doc.addEventListener('keydown', onKey)
  return () => {
    for (const name of events) doc.removeEventListener(name, onPress, { passive: true })
    doc.removeEventListener('keydown', onKey)
  }
}
