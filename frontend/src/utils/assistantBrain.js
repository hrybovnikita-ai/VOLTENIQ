/** Lightweight demo assistant replies — UI-ready for a future AI backend. */
export function localReply(input) {
  const q = String(input || '').toLowerCase()
  if (q.includes('iphone')) {
    return 'For most people, the demo iPhone 16 is the sweet spot. If you want pro cameras and titanium, look at iPhone 16 Pro. All prices shown are demo prices.'
  }
  if (q.includes('macbook')) {
    return 'MacBook Air 13" is great for everyday work and travel. Choose MacBook Pro if you edit video or need sustained performance. Browse the MacBook category to compare.'
  }
  if (q.includes('airpods') || q.includes('headphone')) {
    return 'AirPods Pro 2 are ideal if you want ANC. AirPods 4 are lighter for casual listening. AirPods Max deliver over-ear immersion.'
  }
  if (q.includes('ipad')) {
    return 'iPad Air is a strong everyday tablet. iPad Pro 13" is best if you want a larger Ultra Retina-style canvas for creative work. Check the iPad category for demo pricing.'
  }
  if (q.includes('compare')) {
    return 'Open the Compare page and add up to 4 products from catalog cards. I can help you decide which specs matter most.'
  }
  if (q.includes('gift') || q.includes('student')) {
    return 'Popular demo gift picks: AirPods, Apple Watch, or iPad. Filter the catalog by category to explore.'
  }
  return 'I am the VOLTENIQ shopping assistant UI — currently running a local demo brain. Ask about iPhone, MacBook, iPad, Watch, AirPods, Headphones, or gifts. A real AI backend can be plugged in later.'
}

export const ASSISTANT_SUGGESTIONS = [
  'Best iPhone under $900?',
  'Compare MacBook Air and Pro',
  'What AirPods should I get?',
  'Gift ideas for a student',
]

export const ASSISTANT_WELCOME = 'Hi! How can I help you choose?'
