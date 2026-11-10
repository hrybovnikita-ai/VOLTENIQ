import { config } from '../config.js';

export function isMailConfigured() {
  // Real delivery: Resend. Test harness may set AUTH_TEST_RETURN_TOKEN=1 without sending.
  return Boolean(config.resendApiKey || config.authTestReturnToken);
}

function mailUnavailable() {
  const err = new Error('Email delivery is not configured. Set RESEND_API_KEY (or SMTP_URL) and MAIL_FROM before sending auth emails.');
  err.status = 503;
  err.code = 'mail_not_configured';
  return err;
}

/**
 * Fail closed when no provider is configured — never pretend mail was sent.
 */
export async function sendAuthEmail({ to, subject, text, html }) {
  if (!to || !subject || !text) {
    const err = new Error('Invalid auth email payload');
    err.status = 500;
    throw err;
  }

  if (!isMailConfigured()) {
    throw mailUnavailable();
  }

  // Local/CI tests: accept the send without contacting a provider.
  if (config.authTestReturnToken) {
    return { provider: 'test' };
  }

  const from = config.mailFrom || 'VOLTENIQ <onboarding@resend.dev>';

  if (config.resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html: html || `<pre>${text}</pre>`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const err = new Error('Failed to send email. Please try again later.');
      err.status = 503;
      err.code = 'mail_send_failed';
      err.detail = detail.slice(0, 200);
      throw err;
    }
    return { provider: 'resend' };
  }

  const err = new Error('Set RESEND_API_KEY and MAIL_FROM for production email delivery.');
  err.status = 503;
  err.code = 'mail_not_configured';
  throw err;
}

export function buildVerifyEmailContent({ origin, email, token }) {
  const url = `${origin}/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const subject = 'Verify your VOLTENIQ email';
  const text = [
    'Confirm your VOLTENIQ account email.',
    '',
    `Open this link to verify (expires in 24 hours):`,
    url,
    '',
    'If you did not create this account, ignore this email.',
  ].join('\n');
  const html = `<p>Confirm your VOLTENIQ account email.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`;
  return { subject, text, html, url };
}

export function buildResetPasswordContent({ origin, email, token }) {
  const url = `${origin}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const subject = 'Reset your VOLTENIQ password';
  const text = [
    'Reset your VOLTENIQ password.',
    '',
    `Open this link to choose a new password (expires in 1 hour):`,
    url,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');
  const html = `<p>Reset your VOLTENIQ password.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in 1 hour.</p>`;
  return { subject, text, html, url };
}
