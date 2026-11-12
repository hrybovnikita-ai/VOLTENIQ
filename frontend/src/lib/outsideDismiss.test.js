import test from 'node:test'
import assert from 'node:assert/strict'

import { attachOutsideDismiss } from './outsideDismiss.js'

// Minimal DOM: nodes know their parent so we can model "inside the menu".
function node(parent = null) {
  return { parent }
}
function contains(root, target) {
  for (let n = target; n; n = n.parent) if (n === root) return true
  return false
}

function setup({ pointer }) {
  const doc = new EventTarget()
  const menuRoot = node()
  const signOutButton = node(node(menuRoot))
  const page = node()
  let dismissed = 0
  let escaped = 0
  const detach = attachOutsideDismiss({
    doc,
    win: pointer ? { PointerEvent: function PointerEvent() {} } : {},
    isInside: (target) => contains(menuRoot, target),
    onDismiss: () => { dismissed += 1 },
    onEscape: () => { escaped += 1 },
  })
  const press = (type, target) => {
    const event = new Event(type)
    Object.defineProperty(event, 'target', { value: target })
    doc.dispatchEvent(event)
  }
  const key = (k) => {
    const event = new Event('keydown')
    Object.defineProperty(event, 'key', { value: k })
    doc.dispatchEvent(event)
  }
  return { press, key, detach, signOutButton, page, menuRoot, get dismissed() { return dismissed }, get escaped() { return escaped } }
}

test('iOS/Telegram tap on Sign Out (pointerdown inside) keeps the menu open for the click', () => {
  const s = setup({ pointer: true })
  s.press('pointerdown', s.signOutButton)
  assert.equal(s.dismissed, 0)
})

test('tap outside the menu closes it (pointer events)', () => {
  const s = setup({ pointer: true })
  s.press('pointerdown', s.page)
  assert.equal(s.dismissed, 1)
})

test('older WebViews without Pointer Events use touchstart and mousedown', () => {
  const s = setup({ pointer: false })
  s.press('touchstart', s.signOutButton)
  s.press('mousedown', s.signOutButton)
  assert.equal(s.dismissed, 0, 'touches inside never close the menu')
  s.press('touchstart', s.page)
  assert.equal(s.dismissed, 1)
  s.press('mousedown', s.page)
  assert.equal(s.dismissed, 2)
})

test('blur-style events do not close the menu (the old iOS bug)', () => {
  const s = setup({ pointer: true })
  for (const type of ['blur', 'focusout', 'click', 'touchend']) s.press(type, null)
  assert.equal(s.dismissed, 0)
})

test('Escape closes via onEscape; other keys do nothing', () => {
  const s = setup({ pointer: true })
  s.key('Enter')
  s.key('Escape')
  assert.equal(s.escaped, 1)
  assert.equal(s.dismissed, 0)
})

test('detach removes every listener', () => {
  const s = setup({ pointer: false })
  s.detach()
  s.press('touchstart', s.page)
  s.press('mousedown', s.page)
  s.key('Escape')
  assert.equal(s.dismissed, 0)
  assert.equal(s.escaped, 0)
})

// Full tap sequences as tablets deliver them. With Pointer Events (iPadOS 13+,
// including desktop-mode Safari that reports "Macintosh", Android Chrome) only
// pointerdown is observed; the compatibility touch/mouse events that follow
// must not close the menu either.
test('iPad / iPadOS desktop-mode tap sequence on Sign Out never closes the menu', () => {
  const s = setup({ pointer: true })
  for (const type of ['pointerover', 'pointerdown', 'touchstart', 'pointerup', 'touchend', 'mousedown', 'mouseup', 'click']) {
    s.press(type, s.signOutButton)
  }
  assert.equal(s.dismissed, 0)
})

test('Android tablet tap sequence outside (e.g. the hamburger) closes the menu exactly once', () => {
  const s = setup({ pointer: true })
  for (const type of ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'mousedown', 'mouseup', 'click']) {
    s.press(type, s.page)
  }
  assert.equal(s.dismissed, 1)
})

test('old WebView without Pointer Events: tap on Sign Out (touchstart + emulated mousedown) keeps it open', () => {
  const s = setup({ pointer: false })
  for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'click']) s.press(type, s.signOutButton)
  assert.equal(s.dismissed, 0)
})

test('a press on a text node inside the menu counts as inside', () => {
  const s = setup({ pointer: true })
  const label = { parent: s.signOutButton } // "Sign Out" text node
  s.press('pointerdown', label)
  assert.equal(s.dismissed, 0)
})
