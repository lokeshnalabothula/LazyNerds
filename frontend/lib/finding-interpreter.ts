import type { Finding, SeverityType } from "../types/finding";

export interface ConfigExample {
  platform: "Nginx" | "Apache" | "Cloudflare" | "Next.js / Vercel" | "Node.js / Express";
  filenameOrLocation: string;
  snippet: string;
}

export interface HumanFindingReport {
  id: string;
  originalTitle: string;
  simpleTitle: string;
  severity: SeverityType;
  severityLabel: string;
  severityMeaning: string; // Plain-English explanation of what this severity level means practically
  quickRiskSummary: string; // Concise one-sentence summary for the row/overview
  problemExplanation: string; // 1. What is the problem?
  whyShouldICare: string; // 2. Why should I care?
  howSeriousIsIt: string; // 3. How serious is it?
  whereIsTheProblem: {
    location: string;
    targetUrl: string;
    specificLocation?: string | null;
  };
  evidenceSummary: string; // 5. What did the scanner find?
  rawEvidence?: string | null; // Raw headers or scanner output
  curlCommand?: string;
  recommendedFix: {
    overview: string;
    steps: string[];
    configExamples: ConfigExample[];
  };
  verificationSteps: {
    instructions: string;
    command?: string;
    expectedResult: string;
  };
  whatHappensIfIIgnoreIt: {
    realisticImpact: string;
    limitations: string;
  };
  technicalDetails: {
    cweId?: string | null;
    cweTitle?: string | null;
    cvssScore?: number | null;
    standardsReference?: string | null;
    detectionSource: string;
    timestamp?: string | null;
  };
}

/**
 * Normalizes severity into a human-understandable label and practical explanation.
 */
export function getSeverityMeaning(severity: SeverityType): { label: string; meaning: string } {
  switch (severity) {
    case "critical":
      return {
        label: "Critical Risk",
        meaning:
          "Immediate and severe danger. Attackers can exploit this directly over the internet to compromise accounts, access private databases, or take over server systems without special access.",
      };
    case "high":
      return {
        label: "High Risk",
        meaning:
          "Significant security risk. A core defense mechanism is broken or missing, allowing attackers to hijack sessions, read sensitive customer data, or bypass essential authentication boundaries.",
      };
    case "medium":
      return {
        label: "Medium Risk",
        meaning:
          "Moderate security concern. This issue weakens security protections or transmits data in ways that could be intercepted under specific conditions (such as on public Wi-Fi networks).",
      };
    case "low":
      return {
        label: "Low Risk",
        meaning:
          "Defensive hardening recommendation. Your website is not currently compromised. Fixing this adds an extra layer of defense that stops potential secondary attacks.",
      };
    case "info":
    default:
      return {
        label: "Informational",
        meaning:
          "Neutral observation. This is an informational finding (such as disclosing a software name in headers). It is not an active security vulnerability, but addressing it follows best practices.",
      };
  }
}

/**
 * Interprets a raw technical scanner finding into a clear, structured,
 * 8-section human-readable security report for ordinary website owners and developers.
 */
export function interpretFinding(finding: Finding, defaultTargetUrl: string = ""): HumanFindingReport {
  const title = finding.title || "Unclassified Security Observation";
  const titleLower = title.toLowerCase();
  const severity: SeverityType = (finding.severity?.toLowerCase() as SeverityType) || "low";
  const { label: severityLabel, meaning: severityMeaning } = getSeverityMeaning(severity);
  const targetUrl = defaultTargetUrl || finding.asset_name || "Target Web Application";

  // 1. Strict-Transport-Security (HSTS)
  if (titleLower.includes("strict-transport-security") || titleLower.includes("hsts")) {
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: "Missing Encrypted Connection Guarantee (HSTS)",
      severity: "low",
      severityLabel: "Low Risk",
      severityMeaning:
        "Low Risk. Your website already has HTTPS encryption. HSTS is an extra browser-side safety lock that prevents accidental downgrade attacks. Your site is not compromised.",
      quickRiskSummary:
        "Visitors' browsers aren't instructed to always use HTTPS, leaving connections vulnerable to interception on untrusted Wi-Fi.",
      problemExplanation:
        "Your website supports secure HTTPS encryption, but it does not send the 'Strict-Transport-Security' header. Without this instruction, a visitor's web browser does not know it should permanently refuse plain, unencrypted HTTP connections.",
      whyShouldICare:
        "If a customer visits your site from an untrusted public Wi-Fi network (like in an airport or coffee shop), an attacker on that network could intercept their connection before it upgrades to HTTPS. This technique (called 'SSL-stripping') can expose submitted passwords, form data, or session cookies.",
      howSeriousIsIt:
        "Low Risk. Your website is already encrypted with SSL/TLS. Missing this header does not mean your site was breached or that an attack is taking place. It means your visitors do not have the automatic browser protection that enforces HTTPS at all times.",
      whereIsTheProblem: {
        location: "HTTP Response Headers",
        targetUrl,
        specificLocation: "Missing Header: Strict-Transport-Security",
      },
      evidenceSummary:
        "The scanner requested your website over HTTPS and examined the headers returned by your web server. The 'Strict-Transport-Security' header was missing from the response.",
      rawEvidence: finding.evidence || `GET ${targetUrl}\nStrict-Transport-Security: [Header not present in response]`,
      curlCommand: `curl -I "${targetUrl}"`,
      recommendedFix: {
        overview:
          "Configure your web server or CDN to send the Strict-Transport-Security header with a minimum lifetime of one year (31,536,000 seconds) and include subdomains.",
        steps: [
          "Open your web server configuration file (or log in to your CDN provider dashboard, such as Cloudflare).",
          "Add the Strict-Transport-Security header rule to your HTTPS configuration.",
          "Reload your web server or purge your CDN cache to apply changes.",
        ],
        configExamples: [
          {
            platform: "Cloudflare",
            filenameOrLocation: "Cloudflare Dashboard &rarr; SSL/TLS &rarr; Edge Certificates &rarr; HSTS",
            snippet: "Click 'Enable HSTS', set Max-Age to 12 months, and check 'Apply to all subdomains'.",
          },
          {
            platform: "Nginx",
            filenameOrLocation: "/etc/nginx/nginx.conf (inside your server block for port 443)",
            snippet: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
          },
          {
            platform: "Apache",
            filenameOrLocation: ".htaccess or /etc/apache2/sites-available/your-site.conf",
            snippet: 'Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"',
          },
          {
            platform: "Next.js / Vercel",
            filenameOrLocation: "next.config.js (or next.config.ts)",
            snippet:
              "module.exports = {\n  async headers() {\n    return [\n      {\n        source: '/:path*',\n        headers: [\n          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },\n        ],\n      },\n    ];\n  },\n};",
          },
        ],
      },
      verificationSteps: {
        instructions:
          "Run a curl command in your terminal or use an online header checker tool. Look for the Strict-Transport-Security line in the response.",
        command: `curl -I "${targetUrl}" | grep -i "strict-transport-security"`,
        expectedResult: "Strict-Transport-Security: max-age=31536000; includeSubDomains",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Visitors will still enjoy HTTPS encryption when they type https://. However, if a visitor types your domain as plain http:// on an untrusted public network, an attacker on that network could intercept the initial connection before your server redirects them.",
        limitations:
          "HSTS only takes effect after a browser visits your site at least once over HTTPS, unless your domain is submitted to the HSTS browser preload list (hstspreload.org).",
      },
      technicalDetails: {
        cweId: "CWE-523",
        cweTitle: "Unprotected Transport-Layer Security",
        cvssScore: 3.7,
        standardsReference: "RFC 6797: HTTP Strict Transport Security (HSTS)",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 2. Content-Security-Policy (CSP)
  if (titleLower.includes("content-security-policy") || titleLower.includes("csp")) {
    const isPermissive = titleLower.includes("permissive");
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: isPermissive
        ? "Permissive Content Security Policy (Unsafe Scripts Permitted)"
        : "Missing Content Security Policy (Anti-Cross-Site-Scripting Defense)",
      severity: "low",
      severityLabel: "Low Risk",
      severityMeaning:
        "Defensive hardening measure. Missing or permissive CSP does not mean your site is hacked; it means modern browsers do not have a rulebook to block unauthorized scripts if a bug occurs.",
      quickRiskSummary:
        "Browsers are not given an approved list of trusted scripts, weakening defenses against malicious script injections.",
      problemExplanation: isPermissive
        ? "Your website declares a Content Security Policy, but it includes permissive directives like 'unsafe-inline' or wildcard '*'. These directives tell web browsers to execute inline scripts, which bypasses much of CSP's protective capability."
        : "Your website does not declare a Content Security Policy (CSP). A CSP tells the visitor's web browser exactly which domains and sources are authorized to load JavaScript code, styles, and fonts on your page.",
      whyShouldICare:
        "If a malicious script is ever injected into your website (for example, through an outdated WordPress plugin, comment form, or vulnerable third-party analytics script), the visitor's browser will execute it without verifying its origin. A CSP prevents unauthorized scripts from stealing cookies or redirecting users.",
      howSeriousIsIt:
        "Low to Medium Risk. Missing CSP is not an active exploit. If your website code is secure and does not allow user input to become raw HTML, your site is safe. However, having a CSP provides a crucial safety net if an injection bug is ever discovered.",
      whereIsTheProblem: {
        location: "HTTP Response Headers",
        targetUrl,
        specificLocation: isPermissive ? "Permissive Header: Content-Security-Policy" : "Missing Header: Content-Security-Policy",
      },
      evidenceSummary:
        finding.evidence ||
        (isPermissive
          ? "The server returns a Content-Security-Policy header containing 'unsafe-inline' or wildcard rules."
          : "The scanner inspected server response headers and confirmed that Content-Security-Policy is absent."),
      rawEvidence: finding.evidence,
      curlCommand: `curl -I "${targetUrl}"`,
      recommendedFix: {
        overview:
          "Define a Content Security Policy header specifying that scripts and media can only load from your own domain ('self') and trusted third-party partners.",
        steps: [
          "List the external domains your website relies on (e.g. Google Analytics, Stripe, Google Fonts).",
          "Create a baseline policy restricting sources to 'self' plus those trusted domains.",
          "Add the Content-Security-Policy header to your web server or CDN configuration.",
        ],
        configExamples: [
          {
            platform: "Nginx",
            filenameOrLocation: "/etc/nginx/nginx.conf (inside server block)",
            snippet:
              "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:;\" always;",
          },
          {
            platform: "Apache",
            filenameOrLocation: ".htaccess",
            snippet:
              "Header always set Content-Security-Policy \"default-src 'self'; script-src 'self' https:; style-src 'self' 'unsafe-inline' https:;\"",
          },
          {
            platform: "Next.js / Vercel",
            filenameOrLocation: "next.config.js",
            snippet:
              "const cspHeader = `\n  default-src 'self';\n  script-src 'self' 'unsafe-inline' https:;\n  style-src 'self' 'unsafe-inline' https:;\n  img-src 'self' blob: data: https:;\n  font-src 'self' https:;\n  object-src 'none';\n  base-uri 'self';\n  form-action 'self';\n  frame-ancestors 'none';\n`;",
          },
        ],
      },
      verificationSteps: {
        instructions: "Inspect your website headers using curl and check that Content-Security-Policy appears.",
        command: `curl -I "${targetUrl}" | grep -i "content-security-policy"`,
        expectedResult: "Content-Security-Policy: default-src 'self' ...",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Your website operates normally. However, you lack a secondary browser defense if an attacker ever finds an input vulnerability or if a compromised third-party script loads on your page.",
        limitations:
          "Deploying a strict CSP without testing can inadvertently block legitimate analytics or payment widgets. Always test in 'Content-Security-Policy-Report-Only' mode first if you run complex third-party tools.",
      },
      technicalDetails: {
        cweId: "CWE-693",
        cweTitle: "Protection Mechanism Failure",
        cvssScore: 3.8,
        standardsReference: "W3C Content Security Policy Level 3",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 3. Clickjacking Protection (X-Frame-Options)
  if (titleLower.includes("clickjacking") || titleLower.includes("x-frame-options")) {
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: "Missing Clickjacking Protection (Framing Restriction)",
      severity: "low",
      severityLabel: "Low Risk",
      severityMeaning:
        "Low Risk. A preventative control. It stops other sites from embedding your pages inside hidden frames to trick visitors into clicking buttons.",
      quickRiskSummary:
        "Other websites are permitted to embed your pages inside hidden frames, enabling potential clickjacking tricks.",
      problemExplanation:
        "Your website does not declare an 'X-Frame-Options' header or a CSP 'frame-ancestors' rule. As a result, web browsers allow other websites to display your web pages inside an invisible or transparent frame (iframe).",
      whyShouldICare:
        "A malicious website could load your webpage in a transparent iframe directly beneath an enticing button (like 'Click here to claim a prize'). When an unsuspecting visitor clicks, they are actually clicking an invisible button on your website (such as 'Delete Account' or 'Confirm Purchase').",
      howSeriousIsIt:
        "Low Risk. Clickjacking is only dangerous if your website has authenticated pages where a single click triggers an irreversible action without secondary confirmation or password prompt.",
      whereIsTheProblem: {
        location: "HTTP Response Headers",
        targetUrl,
        specificLocation: "Missing Header: X-Frame-Options",
      },
      evidenceSummary:
        finding.evidence ||
        "The scanner requested your website and checked response headers. Neither X-Frame-Options nor frame-ancestors in CSP were found.",
      rawEvidence: finding.evidence,
      curlCommand: `curl -I "${targetUrl}"`,
      recommendedFix: {
        overview:
          "Add the 'X-Frame-Options: SAMEORIGIN' header to tell browsers that only your own website is allowed to frame your pages.",
        steps: [
          "Open your web server configuration file.",
          "Add the X-Frame-Options header directive set to SAMEORIGIN (or DENY if your site never uses iframes).",
          "Reload the web server.",
        ],
        configExamples: [
          {
            platform: "Nginx",
            filenameOrLocation: "/etc/nginx/nginx.conf (inside server block)",
            snippet: 'add_header X-Frame-Options "SAMEORIGIN" always;',
          },
          {
            platform: "Apache",
            filenameOrLocation: ".htaccess",
            snippet: 'Header always set X-Frame-Options "SAMEORIGIN"',
          },
          {
            platform: "Next.js / Vercel",
            filenameOrLocation: "next.config.js",
            snippet: "{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }",
          },
        ],
      },
      verificationSteps: {
        instructions: "Verify that the header is returned using curl in your terminal.",
        command: `curl -I "${targetUrl}" | grep -i "x-frame-options"`,
        expectedResult: "X-Frame-Options: SAMEORIGIN",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Other websites will be able to embed your web pages in an iframe. If your site does not feature sensitive logged-in actions, the immediate risk is low.",
        limitations:
          "If your business intentionally embeds pages on partner websites (e.g. an embedded booking widget), using DENY or SAMEORIGIN will break that widget. In that case, use CSP frame-ancestors with an explicit domain list.",
      },
      technicalDetails: {
        cweId: "CWE-1021",
        cweTitle: "Improper Restriction of Rendered UI Layers or Frames",
        cvssScore: 3.4,
        standardsReference: "RFC 7034: HTTP Header Field X-Frame-Options",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 4. MIME Sniffing Protection (X-Content-Type-Options)
  if (titleLower.includes("x-content-type-options") || titleLower.includes("mime")) {
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: "Missing File Type Protection (X-Content-Type-Options)",
      severity: "low",
      severityLabel: "Low Risk",
      severityMeaning:
        "Standard browser hygiene. Prevents older or buggy browsers from misinterpreting text or image files as executable code.",
      quickRiskSummary:
        "Browsers may try to guess file types instead of honoring the server's declaration, risking script execution in uploaded files.",
      problemExplanation:
        "Your server does not send the 'X-Content-Type-Options: nosniff' header. Without this header, some web browsers might inspect the contents of a file (called 'MIME sniffing') and execute it as JavaScript code even if your server declared it as a simple text file or image.",
      whyShouldICare:
        "If your website allows visitors to upload files (such as avatar pictures, profile resumes, or attachments), an attacker could upload an executable script disguised as an image. If a browser sniffs it as HTML/JavaScript, it could execute in the visitor's browser.",
      howSeriousIsIt:
        "Low Risk. Modern browsers are significantly stricter than older ones, but setting 'nosniff' is a universal baseline standard that costs zero performance.",
      whereIsTheProblem: {
        location: "HTTP Response Headers",
        targetUrl,
        specificLocation: "Missing Header: X-Content-Type-Options",
      },
      evidenceSummary:
        finding.evidence ||
        "The response headers from your web server do not include 'X-Content-Type-Options: nosniff'.",
      rawEvidence: finding.evidence,
      curlCommand: `curl -I "${targetUrl}"`,
      recommendedFix: {
        overview: "Configure your web server to append 'X-Content-Type-Options: nosniff' to every HTTP response.",
        steps: [
          "Open your web server or CDN configuration.",
          "Add the directive to set X-Content-Type-Options to 'nosniff'.",
          "Reload your web server.",
        ],
        configExamples: [
          {
            platform: "Nginx",
            filenameOrLocation: "/etc/nginx/nginx.conf (inside server block)",
            snippet: 'add_header X-Content-Type-Options "nosniff" always;',
          },
          {
            platform: "Apache",
            filenameOrLocation: ".htaccess",
            snippet: 'Header always set X-Content-Type-Options "nosniff"',
          },
          {
            platform: "Next.js / Vercel",
            filenameOrLocation: "next.config.js",
            snippet: "{ key: 'X-Content-Type-Options', value: 'nosniff' }",
          },
        ],
      },
      verificationSteps: {
        instructions: "Run curl to verify the header is active.",
        command: `curl -I "${targetUrl}" | grep -i "x-content-type-options"`,
        expectedResult: "X-Content-Type-Options: nosniff",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "If your website does not host user-uploaded files, the practical risk is near zero. If you do host user uploads, an attacker could potentially weaponize file uploads against specific browsers.",
        limitations: "This header has no negative side effects when your web server serves valid Content-Type headers.",
      },
      technicalDetails: {
        cweId: "CWE-693",
        cweTitle: "Protection Mechanism Failure",
        cvssScore: 3.1,
        standardsReference: "Fetch Standard - X-Content-Type-Options",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 5. Insecure HTTP Protocol & Missing HTTPS Redirect
  if (titleLower.includes("insecure http") || titleLower.includes("https redirection")) {
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: "Unencrypted HTTP Allowed (Missing Automatic HTTPS Redirect)",
      severity: "medium",
      severityLabel: "Medium Risk",
      severityMeaning:
        "Medium Risk. Visitors who do not manually type 'https://' may browse in plain text, making their traffic visible to anyone on the same network.",
      quickRiskSummary:
        "Visitors who type your domain without 'https://' might browse over unencrypted connections where traffic can be read or intercepted.",
      problemExplanation:
        "When visitors connect to your website over plain HTTP (port 80), the server delivers the page without automatically redirecting them to the secure, encrypted HTTPS version (port 443).",
      whyShouldICare:
        "Plain HTTP traffic is completely unencrypted. Anyone between your visitor and your server (such as an ISP, a mobile carrier, or anyone on the same public Wi-Fi network) can see exactly what pages they visit, read submitted forms, and potentially inject ads or malicious scripts into the page.",
      howSeriousIsIt:
        "Medium Risk. While your website may support HTTPS when requested, failing to force it leaves casual visitors browsing in the clear without realizing it.",
      whereIsTheProblem: {
        location: "Port 80 (HTTP) Server Configuration",
        targetUrl,
        specificLocation: "Missing Permanent (301) Redirect to HTTPS",
      },
      evidenceSummary:
        finding.evidence ||
        `The scanner sent a request to ${targetUrl} over plain HTTP. The server returned HTTP 200 OK instead of an HTTP 301/308 redirect to HTTPS.`,
      rawEvidence: finding.evidence,
      curlCommand: `curl -I "${targetUrl.replace('https://', 'http://')}"`,
      recommendedFix: {
        overview: "Configure your web server or CDN to automatically redirect all port 80 (HTTP) requests to HTTPS with an HTTP 301 permanent redirect.",
        steps: [
          "In your CDN or hosting control panel, turn on automatic HTTPS redirection.",
          "If managing Nginx or Apache, add a redirect directive in your port 80 virtual host.",
          "Verify that visiting http://yourdomain.com immediately switches to https:// in your browser.",
        ],
        configExamples: [
          {
            platform: "Cloudflare",
            filenameOrLocation: "Cloudflare Dashboard &rarr; SSL/TLS &rarr; Edge Certificates",
            snippet: "Turn on 'Always Use HTTPS'.",
          },
          {
            platform: "Nginx",
            filenameOrLocation: "/etc/nginx/sites-available/your-site.conf (port 80 block)",
            snippet: "server {\n    listen 80;\n    server_name yourdomain.com www.yourdomain.com;\n    return 301 https://$host$request_uri;\n}",
          },
          {
            platform: "Apache",
            filenameOrLocation: ".htaccess or virtual host",
            snippet: "RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]",
          },
        ],
      },
      verificationSteps: {
        instructions: "Run curl against the plain HTTP version of your site and verify it returns HTTP 301 to https://.",
        command: `curl -I "${targetUrl.replace('https://', 'http://')}"`,
        expectedResult: "HTTP/1.1 301 Moved Permanently\nLocation: https://...",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Visitors who type your domain name into their browser address bar without explicitly typing 'https://' will browse unencrypted until they click an HTTPS link.",
        limitations: "Once a visitor is on HTTPS, their traffic is encrypted. The vulnerability exists only for visits that enter via plain HTTP.",
      },
      technicalDetails: {
        cweId: "CWE-319",
        cweTitle: "Cleartext Transmission of Sensitive Information",
        cvssScore: 5.3,
        standardsReference: "NIST SP 800-52 Rev. 2: Guidelines for TLS Implementations",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 6. SSL/TLS Certificate Expiration & Validity
  if (titleLower.includes("certificate") && (titleLower.includes("expired") || titleLower.includes("untrusted"))) {
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: "Expired or Untrusted Security Certificate (SSL/TLS)",
      severity: "high",
      severityLabel: "High Risk",
      severityMeaning:
        "High Risk. Actively disrupts visitor access. Web browsers will block visitors with scary warning screens, destroying trust.",
      quickRiskSummary:
        "Visitors are blocked by full-page browser security warnings, and connection authenticity cannot be verified.",
      problemExplanation:
        "The digital security certificate that proves your website's identity and encrypts connections has expired or was not issued by a recognized Certificate Authority.",
      whyShouldICare:
        "Every visitor who visits your website will see a full-page browser warning (e.g. 'Your connection is not private'). Most visitors will immediately leave your site, causing severe loss of traffic, revenue, and customer trust.",
      howSeriousIsIt:
        "High Risk. An expired or untrusted certificate actively breaks the user experience and damages your search engine ranking.",
      whereIsTheProblem: {
        location: "SSL/TLS Server Certificate",
        targetUrl,
        specificLocation: "Port 443 Certificate Handshake",
      },
      evidenceSummary:
        finding.evidence ||
        "The scanner attempted an SSL/TLS handshake with your server. The presented certificate failed validation because it is expired or untrusted.",
      rawEvidence: finding.evidence,
      curlCommand: `curl -vI "${targetUrl}"`,
      recommendedFix: {
        overview: "Renew your SSL/TLS certificate immediately through your hosting provider, domain registrar, or Let's Encrypt.",
        steps: [
          "Log in to your hosting provider, cloud account, or domain registrar.",
          "Check the SSL/TLS section and trigger certificate renewal.",
          "If using Let's Encrypt on Linux, run 'sudo certbot renew'.",
        ],
        configExamples: [
          {
            platform: "Cloudflare",
            filenameOrLocation: "Cloudflare Dashboard &rarr; SSL/TLS",
            snippet: "Ensure 'Universal SSL' is active and edge certificates are valid.",
          },
          {
            platform: "Nginx",
            filenameOrLocation: "Linux Server Terminal",
            snippet: "sudo certbot renew --nginx",
          },
          {
            platform: "Apache",
            filenameOrLocation: "Linux Server Terminal",
            snippet: "sudo certbot renew --apache",
          },
        ],
      },
      verificationSteps: {
        instructions: "Visit your website in a browser or test the certificate expiration date in your terminal.",
        command: `echo | openssl s_client -connect $(echo "${targetUrl}" | sed -e 's|^[^/]*//||' -e 's|/.*$||'):443 -servername $(echo "${targetUrl}" | sed -e 's|^[^/]*//||' -e 's|/.*$||') 2>/dev/null | openssl x509 -noout -dates`,
        expectedResult: "notAfter=... [Date in the future]",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Your website remains inaccessible to ordinary visitors because modern browsers refuse to connect to domains with expired certificates.",
        limitations: "Certificates can be renewed at any time to immediately restore access.",
      },
      technicalDetails: {
        cweId: "CWE-295",
        cweTitle: "Improper Certificate Validation",
        cvssScore: 7.5,
        standardsReference: "RFC 5280: X.509 Public Key Infrastructure Certificate Profile",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 7. Cookie Security (HttpOnly / Secure / SameSite)
  if (titleLower.includes("cookie")) {
    const isHttpOnly = titleLower.includes("httponly");
    const isSecure = titleLower.includes("secure");
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: isHttpOnly
        ? "Sensitive Cookie Accessible to Scripts (Missing HttpOnly)"
        : isSecure
        ? "Cookie Not Restricted to Encrypted Connections (Missing Secure Flag)"
        : "Cookie Missing Cross-Site Protection (Missing SameSite)",
      severity: isSecure ? "medium" : "low",
      severityLabel: isSecure ? "Medium Risk" : "Low Risk",
      severityMeaning:
        "Defensive hardening measure. The cookie is not compromised on its own, but adding security flags protects it against secondary attacks.",
      quickRiskSummary: isHttpOnly
        ? "If a script injection vulnerability exists, attackers could read this cookie using JavaScript."
        : isSecure
        ? "The browser may send this cookie over unencrypted connections if an unencrypted link is clicked."
        : "Third-party websites might be able to make background requests including this cookie.",
      problemExplanation: isHttpOnly
        ? "A cookie set by your server does not have the 'HttpOnly' flag. When this flag is missing, client-side JavaScript code (document.cookie) can read the cookie value."
        : isSecure
        ? "A cookie was sent over an encrypted HTTPS connection, but it did not declare the 'Secure' attribute. Browsers might send this cookie over subsequent plain HTTP connections."
        : "A cookie set by your server lacks the 'SameSite' attribute, leaving it vulnerable to being transmitted in third-party cross-site requests.",
      whyShouldICare:
        "Cookies often store user authentication tokens, session identifiers, and shopping cart keys. Setting proper security flags prevents attackers from stealing session cookies through XSS or abusing them via Cross-Site Request Forgery (CSRF).",
      howSeriousIsIt:
        "Low to Medium Risk. The cookie itself is not breached. Configuring these flags is standard practice for modern web frameworks.",
      whereIsTheProblem: {
        location: "Set-Cookie HTTP Response Header",
        targetUrl,
        specificLocation: finding.evidence ? `Cookie in: ${finding.evidence.slice(0, 60)}` : "Set-Cookie Header",
      },
      evidenceSummary: finding.evidence || "The Set-Cookie header lacks required security flags (HttpOnly/Secure/SameSite).",
      rawEvidence: finding.evidence,
      curlCommand: `curl -I "${targetUrl}" | grep -i "set-cookie"`,
      recommendedFix: {
        overview: "Update your backend application session or cookie configuration to enable HttpOnly, Secure, and SameSite=Lax (or Strict).",
        steps: [
          "Locate your application's session or cookie creation logic.",
          "Set httpOnly to true, secure to true, and sameSite to 'lax' or 'strict'.",
          "Deploy the updated application code.",
        ],
        configExamples: [
          {
            platform: "Node.js / Express",
            filenameOrLocation: "app.js / server.js (session middleware)",
            snippet: "app.use(session({\n  cookie: {\n    secure: true,\n    httpOnly: true,\n    sameSite: 'lax'\n  }\n}));",
          },
          {
            platform: "Next.js / Vercel",
            filenameOrLocation: "cookies().set() options",
            snippet: "cookies().set('token', value, {\n  httpOnly: true,\n  secure: process.env.NODE_ENV === 'production',\n  sameSite: 'lax',\n  path: '/',\n});",
          },
        ],
      },
      verificationSteps: {
        instructions: "Inspect the Set-Cookie response header and check that HttpOnly, Secure, and SameSite appear.",
        command: `curl -I "${targetUrl}" | grep -i "set-cookie"`,
        expectedResult: "Set-Cookie: ...; HttpOnly; Secure; SameSite=Lax",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Normal browsing continues undisturbed. However, if a Cross-Site Scripting (XSS) vulnerability exists, attackers could harvest session cookies directly from visitors' browsers.",
        limitations: "Cookies that genuinely need to be read by front-end JavaScript (such as UI theme preferences) should not have HttpOnly set.",
      },
      technicalDetails: {
        cweId: isHttpOnly ? "CWE-1004" : isSecure ? "CWE-614" : "CWE-1275",
        cweTitle: isHttpOnly ? "Cookie Without 'HttpOnly' Flag" : "Cookie Without 'Secure' Attribute",
        cvssScore: isSecure ? 4.3 : 3.5,
        standardsReference: "RFC 6265: HTTP State Management Mechanism (Cookies)",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 8. Server Banner / Technology Exposure
  if (titleLower.includes("server technology") || titleLower.includes("banner") || titleLower.includes("disclosure")) {
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: "Server Software & Version Details Disclosed in Headers",
      severity: "info",
      severityLabel: "Informational",
      severityMeaning:
        "Informational finding. Your website is not vulnerable because of this header alone. Hiding it follows the principle of defense-in-depth.",
      quickRiskSummary:
        "The server broadcasts its software name and version in HTTP headers, providing reconnaissance hints to potential adversaries.",
      problemExplanation:
        "Your web server sends headers like 'Server: Apache/2.4.41' or 'X-Powered-By: PHP/7.4.3'. These headers broadcast the exact name and version of the software powering your website.",
      whyShouldICare:
        "Broadcasting your exact software version helps attackers determine which unpatched security bugs or public exploits might exist for that specific build.",
      howSeriousIsIt:
        "Informational. This is not an exploitable vulnerability. It is a reconnaissance observation. Removing banner headers is considered a defense-in-depth best practice.",
      whereIsTheProblem: {
        location: "HTTP Response Headers",
        targetUrl,
        specificLocation: "Header: Server or X-Powered-By",
      },
      evidenceSummary: finding.evidence || "The server returned detailed version information in the Server or X-Powered-By header.",
      rawEvidence: finding.evidence,
      curlCommand: `curl -I "${targetUrl}"`,
      recommendedFix: {
        overview: "Configure your web server to suppress or generalize the Server and X-Powered-By response headers.",
        steps: [
          "Open your web server configuration file.",
          "Add the directive to hide detailed version numbers.",
          "Reload the web server.",
        ],
        configExamples: [
          {
            platform: "Nginx",
            filenameOrLocation: "/etc/nginx/nginx.conf (inside http block)",
            snippet: "server_tokens off;",
          },
          {
            platform: "Apache",
            filenameOrLocation: "/etc/apache2/conf-available/security.conf",
            snippet: "ServerTokens Prod\nServerSignature Off",
          },
          {
            platform: "Node.js / Express",
            filenameOrLocation: "app.js",
            snippet: "app.disable('x-powered-by');",
          },
        ],
      },
      verificationSteps: {
        instructions: "Run curl to check that version numbers no longer appear in response headers.",
        command: `curl -I "${targetUrl}" | grep -Ei "server|x-powered-by"`,
        expectedResult: "Server: cloudflare (or generalized name without version numbers)",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Attackers scanning your site can see what software version you run, but they cannot breach your site unless that software actually contains an unpatched vulnerability.",
        limitations: "Sophisticated attackers can sometimes infer software types by analyzing specific error pages or URL patterns.",
      },
      technicalDetails: {
        cweId: "CWE-200",
        cweTitle: "Exposure of Sensitive Information",
        cvssScore: 0.0,
        standardsReference: "OWASP Cheat Sheet: Information Exposure",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 9. CORS Misconfiguration
  if (titleLower.includes("cors")) {
    return {
      id: finding.id,
      originalTitle: title,
      simpleTitle: "Cross-Origin Access Policy Allows Untrusted Domains (CORS Misconfiguration)",
      severity: severity === "high" ? "high" : "medium",
      severityLabel: severity === "high" ? "High Risk" : "Medium Risk",
      severityMeaning:
        severity === "high"
          ? "High Risk. The server reflects arbitrary Origin headers while allowing credentials, potentially enabling external websites to read private user data."
          : "Medium Risk. The server reflects arbitrary Origin headers without credentials, permitting unauthenticated cross-domain data reading.",
      quickRiskSummary:
        "External websites are permitted to make background browser requests and read response data from your site.",
      problemExplanation:
        "Cross-Origin Resource Sharing (CORS) tells browsers which other websites are allowed to make background JavaScript requests to your application. Your server currently echoes whatever 'Origin' an external website sends.",
      whyShouldICare:
        "An attacker could create a malicious website. If one of your logged-in users visits the attacker's site, the attacker's page could make background requests to your website and read private customer account data.",
      howSeriousIsIt:
        severity === "high"
          ? "High Risk. Because credentials (cookies or tokens) are permitted, sensitive account data could be read by external origins."
          : "Medium Risk. The endpoint allows arbitrary domains to read public or unauthenticated data.",
      whereIsTheProblem: {
        location: "CORS Headers (Access-Control-Allow-Origin)",
        targetUrl,
        specificLocation: "Header: Access-Control-Allow-Origin",
      },
      evidenceSummary:
        finding.evidence ||
        "The scanner sent a request with Origin: https://fixops-security-audit.example.com and the server echoed this arbitrary origin back in Access-Control-Allow-Origin.",
      rawEvidence: finding.evidence,
      curlCommand: `curl -H "Origin: https://evil.example.com" -I "${targetUrl}"`,
      recommendedFix: {
        overview: "Replace dynamic Origin echoing with an explicit allowlist of authorized domains (such as your own front-end domain).",
        steps: [
          "Open your API or web server CORS configuration.",
          "Remove arbitrary origin reflection.",
          "Specify an explicit array of allowed domain names.",
        ],
        configExamples: [
          {
            platform: "Node.js / Express",
            filenameOrLocation: "server.js (cors middleware)",
            snippet:
              "const allowedOrigins = ['https://yourdomain.com', 'https://app.yourdomain.com'];\napp.use(cors({\n  origin: (origin, callback) => {\n    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);\n    return callback(new Error('Blocked by CORS'));\n  },\n  credentials: true\n}));",
          },
          {
            platform: "Nginx",
            filenameOrLocation: "/etc/nginx/nginx.conf",
            snippet:
              'if ($http_origin ~* "^https://(app\\.yourdomain\\.com|yourdomain\\.com)$") {\n    add_header Access-Control-Allow-Origin "$http_origin" always;\n    add_header Access-Control-Allow-Credentials "true" always;\n}',
          },
        ],
      },
      verificationSteps: {
        instructions: "Send a request with an untrusted Origin header and confirm it is NOT reflected.",
        command: `curl -H "Origin: https://evil.example.com" -I "${targetUrl}" | grep -i "access-control-allow-origin"`,
        expectedResult: "[No Access-Control-Allow-Origin returned, or returns your trusted domain only]",
      },
      whatHappensIfIIgnoreIt: {
        realisticImpact:
          "Malicious third-party websites can issue background fetch requests to your endpoints and read the returned responses.",
        limitations: "Browsers enforce CORS on frontend JavaScript requests; it does not block backend-to-backend API calls.",
      },
      technicalDetails: {
        cweId: "CWE-942",
        cweTitle: "Overly Permissive Cross-Origin Whitelist",
        cvssScore: severity === "high" ? 7.5 : 5.3,
        standardsReference: "W3C Cross-Origin Resource Sharing",
        detectionSource: finding.remediation_notes || "FixOps Web Security Auditor",
        timestamp: finding.created_at,
      },
    };
  }

  // 10. Default / Fallback Generic Finding Handler
  return {
    id: finding.id,
    originalTitle: title,
    simpleTitle: title,
    severity,
    severityLabel,
    severityMeaning,
    quickRiskSummary:
      finding.description?.slice(0, 150) || "Security configuration finding identified on target perimeter.",
    problemExplanation:
      finding.description ||
      "The scanner identified a security configuration issue or potential vulnerability on the target web application.",
    whyShouldICare:
      finding.impact ||
      "Addressing this issue strengthens your perimeter defenses and eliminates attack surface that could be targeted by adversaries.",
    howSeriousIsIt: `${severityLabel}. ${severityMeaning}`,
    whereIsTheProblem: {
      location: "Target Web Application",
      targetUrl,
      specificLocation: finding.asset_name || targetUrl,
    },
    evidenceSummary: finding.evidence?.slice(0, 300) || "Scanner observed configuration behavior matching this rule.",
    rawEvidence: finding.evidence || undefined,
    curlCommand: `curl -I "${targetUrl}"`,
    recommendedFix: {
      overview: finding.remediation_guidance || "Review server or application configuration to address this finding.",
      steps: [
        "Review the technical evidence and identified affected asset.",
        "Implement the recommended remediation guidance in your web server or code.",
        "Re-scan the target URL to verify resolution.",
      ],
      configExamples: [],
    },
    verificationSteps: {
      instructions: "Re-run the FixOps Website Audit scan after applying configuration changes to confirm resolution.",
      command: `curl -I "${targetUrl}"`,
      expectedResult: "Finding no longer appears in audit results.",
    },
    whatHappensIfIIgnoreIt: {
      realisticImpact:
        finding.impact || "The potential risk remains present on the target until the recommended fix is applied.",
      limitations: "Automated scanner checks evaluate perimeter indicators; manual code audit may reveal additional context.",
    },
    technicalDetails: {
      cweId: finding.cve_id || undefined,
      cweTitle: finding.cve_id ? `Vulnerability Reference: ${finding.cve_id}` : undefined,
      cvssScore: finding.cvss_score || undefined,
      standardsReference: finding.references_url || undefined,
      detectionSource: finding.remediation_notes || "FixOps Security Scanner",
      timestamp: finding.created_at,
    },
  };
}
