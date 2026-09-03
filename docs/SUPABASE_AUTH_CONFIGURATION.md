# Supabase Auth configuration for easyACR

Complete these settings in the Supabase dashboard before public traffic. The
project API keys cannot update them; they are account-administration settings.

## URL configuration

In **Authentication → URL Configuration**:

- Site URL: `https://app.easyacr.com`
- Redirect URLs: `https://app.easyacr.com/tools`

Use a staging hostname first if the production DNS name is not live. Do not use
a wildcard redirect URL.

## Magic-link email

In **Authentication → Email Templates → Magic Link**, use a subject such as
`Sign in to easyACR` and this concise body:

```html
<h2>Sign in to easyACR</h2>
<p>Use this secure, one-time link to continue to your accessibility-evidence workspace.</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to easyACR</a></p>
<p>This link expires automatically. If you did not request it, you can ignore this email.</p>
```

## SMTP

Use a transactional provider with a verified `easyacr.com` sender domain. For
the public beta, Resend is a suitable default: verify the domain, create an API
key scoped to mail send, then enter its SMTP host, port, username, and key in
**Authentication → SMTP Settings**. Send a magic link to a controlled inbox and
verify the redirect returns to `/tools` over HTTPS.

Never place SMTP credentials, the Supabase service-role key, or a Supabase
personal access token in Vite variables, source code, GitHub Actions logs, or
this repository.
