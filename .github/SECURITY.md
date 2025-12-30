# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to the Security tab of this repository
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email**
   - Send an email to: info@zasciahugo.com
   - Use the subject line: `[SECURITY] Wallet API - <Brief Description>`

### What to Include

Please include the following information in your report:

- **Type of vulnerability** (e.g., SQL injection, authentication bypass, XSS)
- **Location** of the vulnerability (file path, endpoint, line number if known)
- **Steps to reproduce** the vulnerability
- **Proof of concept** (if available)
- **Impact assessment** - what an attacker could achieve
- **Suggested fix** (if you have one)

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
2. **Assessment**: We will investigate and validate the vulnerability within 7 days
3. **Updates**: We will keep you informed of our progress
4. **Resolution**: We aim to resolve critical vulnerabilities within 30 days
5. **Disclosure**: We will coordinate with you on public disclosure timing

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations and disruptions to others
- Only interact with accounts you own or with explicit permission
- Do not exploit a vulnerability beyond what is necessary to demonstrate the issue
- Report vulnerabilities promptly and don't publicly disclose before we've addressed them

We will not pursue legal action against researchers who follow these guidelines.

## Security Best Practices

When using this API in production:

### Environment Variables

- Use strong, unique secrets for `JWT_SECRET` and `REQUEST_SIGNING_SECRET` (64+ bytes)
- Never commit `.env` files to version control
- Rotate secrets regularly

### Network Security

- Always use HTTPS in production
- Implement rate limiting at the infrastructure level
- Use a Web Application Firewall (WAF)
- Restrict database access to application servers only

### Authentication

- Store JWT secrets securely
- Implement token rotation
- Use short token expiration times
- Validate all tokens on every request

### Request Signing

- Keep signing secrets secure and unique per client
- Use appropriate `SIGNATURE_TTL_MS` values (recommended: 30000-60000ms)
- Monitor for replay attacks
- Ensure Redis is properly secured for nonce storage

### Database

- Use encrypted connections to MySQL
- Implement least-privilege database users
- Enable audit logging
- Regular backups with encryption

### Monitoring

- Log all authentication failures
- Monitor for unusual transaction patterns
- Set up alerts for security events
- Regularly review access logs

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.x).

Subscribe to releases to be notified of security updates:

1. Go to the repository main page
2. Click "Watch" → "Custom" → Check "Releases"

## Acknowledgments

We would like to thank the following security researchers for their responsible disclosure:

<!-- List will be updated as vulnerabilities are reported and resolved -->

---

Thank you for helping keep Wallet Transaction API and its users safe!
