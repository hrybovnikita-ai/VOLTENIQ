const secretKey = process.env.CLERK_SECRET_KEY;
const publishableKey =
  process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const proxyUrl = (
  process.env.CLERK_PROXY_URL
  || process.env.VITE_CLERK_PROXY_URL
  || 'https://volteniq.vercel.app/__clerk'
).replace(/\/$/, '');

if (!secretKey) {
  console.error('missing CLERK_SECRET_KEY');
  process.exit(1);
}

console.log('has_publishable', Boolean(publishableKey));
console.log('target_proxy_url', proxyUrl);

async function clerkApi(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  if (!response.ok) {
    const err = new Error(data?.errors?.[0]?.message || data?.message || `Clerk API ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

const list = await clerkApi('/domains');
const domains = Array.isArray(list) ? list : list?.data || [];

if (!domains.length) {
  console.error('no_clerk_domains');
  process.exit(1);
}

for (const domain of domains) {
  const current = domain.proxy_url || domain.proxyUrl || null;
  console.log(
    JSON.stringify({
      id: domain.id,
      name: domain.name,
      isPrimary: domain.is_primary ?? domain.isPrimary ?? null,
      currentProxyUrl: current,
    })
  );

  if (current === proxyUrl) {
    console.log('proxy_already_configured', domain.id);
    continue;
  }

  try {
    const updated = await clerkApi(`/domains/${domain.id}`, {
      method: 'PATCH',
      body: { proxy_url: proxyUrl },
    });
    console.log(
      JSON.stringify({
        updated: domain.id,
        proxyUrl: updated.proxy_url || updated.proxyUrl || proxyUrl,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        update_failed: domain.id,
        message: error?.message || String(error),
        status: error?.status || null,
        details: error?.data?.errors || null,
      })
    );
  }
}
