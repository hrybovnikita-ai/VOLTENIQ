export function rememberPurchase(order) {
  if (!order?.id || !order.userId) return
  try { localStorage.setItem('volteniq:purchase:' + order.userId, order.id) } catch { /* storage unavailable */ }
}
