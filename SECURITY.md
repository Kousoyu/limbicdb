# Security Policy

## Supported Versions

LimbicDB is currently in **alpha** stage. Security updates are provided for the latest release only.

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| < 0.4   | :x:                |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

If you believe you've found a security vulnerability in LimbicDB:

1. **Email the maintainer** at 770668004@qq.com
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Report
- Remote code execution vulnerabilities
- Data leakage or privacy issues  
- Authentication/authorization bypasses
- File system access outside intended scope
- SQL injection or other injection attacks

### What Not to Report
- Missing security headers on documentation site
- Theoretical vulnerabilities without proof-of-concept
- Vulnerabilities in dependencies (report to dependency maintainers)
- Best practice violations without exploitability

## Security Considerations for LimbicDB

### Data Storage
- LimbicDB stores data in SQLite files (`.limbic` extension)
- Files are not encrypted by default
- Users should implement file-level encryption if needed
- No automatic data deletion - users manage retention

### Embedding Functions
- LimbicDB supports bring-your-own embedder
- Embedding functions run with user privileges
- Malicious embedder functions could exfiltrate data
- Users should only use trusted embedding providers

### Memory Access
- All memories are accessible to the process
- No built-in access control between memories
- For multi-tenant use, use separate LimbicDB instances

### Best Practices
1. **File permissions** - Set appropriate permissions on `.limbic` files
2. **Embedder vetting** - Only use embedders from trusted sources
3. **Input validation** - Validate user input before storing as memories
4. **Regular updates** - Keep LimbicDB updated to latest version

## Security Disclosure Process

1. **Initial report** - Vulnerability reported via email
2. **Acknowledgement** - Maintainer acknowledges within 48 hours
3. **Investigation** - Maintainer investigates and validates
4. **Fix development** - Fix developed and tested
5. **Release** - New version released with fix
6. **Disclosure** - Vulnerability disclosed publicly (typically 7-14 days after fix)

## History

No security vulnerabilities have been reported to date.

---

*Last updated: March 2026*