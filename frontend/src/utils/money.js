export const toMoneyInt = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed)
}

export const formatMoney = (value, fallback = '—') => {
  const amount = toMoneyInt(value)
  return amount == null ? fallback : `₹${amount}`
}
