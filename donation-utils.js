function formatRequestedCharge(charge) {
  if (charge === null || charge === undefined || charge === '') return null;
  const num = parseFloat(charge);
  if (Number.isNaN(num) || num < 0) return null;
  return `₹${num.toFixed(num % 1 === 0 ? 0 : 2)}`;
}

function chargeDetailHtml(charge, label = 'Donor charge') {
  const formatted = formatRequestedCharge(charge);
  if (!formatted) return '';
  return `<div class="detail-row charge-row"><span class="charge-badge">💰 ${label}: ${formatted}</span></div>`;
}

function chargeBadgeHtml(charge) {
  const formatted = formatRequestedCharge(charge);
  if (!formatted) return '';
  return `<span class="charge-badge">💰 ${formatted}</span>`;
}
