/**
 * Persistent security configuration for the workspace.
 * Stored at data/security-config.json.
 */
import fs from 'fs'
import path from 'path'

export interface SecurityConfig {
  authentication: {
    ssoEnabled:           boolean
    ssoProvider:          'okta' | 'azure-ad' | 'google' | 'none'
    mfaRequired:          boolean
    mfaMethod:            'totp' | 'sms' | 'webauthn'
    passwordMinLength:    number
    passwordRequireSpecial: boolean
    passwordRotateDays:   number
  }
  session: {
    timeoutMinutes:       number
    maxConcurrent:        number
    rememberMeAllowed:    boolean
  }
  access: {
    ipAllowlistEnabled:   boolean
    ipAllowlist:          string[]
    rbacEnabled:          boolean
    defaultRole:          'viewer' | 'analyst' | 'editor' | 'admin'
  }
  dataProtection: {
    encryptAtRest:        boolean
    encryptInTransit:     boolean
    piiDetection:         boolean
    piiMaskingInLogs:     boolean
    queryAuditEnabled:    boolean
  }
  api: {
    keyRotationDays:      number
    webhookSigning:       boolean
    rateLimitPerMinute:   number
    requireHttps:         boolean
  }
  audit: {
    retentionDays:        number
    exportEnabled:        boolean
    anomalyDetection:     boolean
  }
  compliance: {
    soc2:                 boolean
    gdpr:                 boolean
    hipaa:                boolean
    iso27001:             boolean
  }
}

const DEFAULT_CONFIG: SecurityConfig = {
  authentication: {
    ssoEnabled:           false,
    ssoProvider:          'none',
    mfaRequired:          true,
    mfaMethod:            'totp',
    passwordMinLength:    12,
    passwordRequireSpecial: true,
    passwordRotateDays:   90,
  },
  session: {
    timeoutMinutes:       60,
    maxConcurrent:        3,
    rememberMeAllowed:    false,
  },
  access: {
    ipAllowlistEnabled:   false,
    ipAllowlist:          [],
    rbacEnabled:          true,
    defaultRole:          'viewer',
  },
  dataProtection: {
    encryptAtRest:        true,
    encryptInTransit:     true,
    piiDetection:         true,
    piiMaskingInLogs:     true,
    queryAuditEnabled:    true,
  },
  api: {
    keyRotationDays:      90,
    webhookSigning:       true,
    rateLimitPerMinute:   600,
    requireHttps:         true,
  },
  audit: {
    retentionDays:        365,
    exportEnabled:        true,
    anomalyDetection:     true,
  },
  compliance: {
    soc2:                 true,
    gdpr:                 true,
    hipaa:                false,
    iso27001:             false,
  },
}

const FILE = path.join(process.cwd(), 'data', 'security-config.json')

export function readSecurityConfig(): SecurityConfig {
  if (!fs.existsSync(FILE)) return DEFAULT_CONFIG
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Partial<SecurityConfig>
    // Deep merge with defaults so missing keys fall back gracefully
    return {
      authentication: { ...DEFAULT_CONFIG.authentication, ...(raw.authentication ?? {}) },
      session:        { ...DEFAULT_CONFIG.session,        ...(raw.session        ?? {}) },
      access:         { ...DEFAULT_CONFIG.access,         ...(raw.access         ?? {}) },
      dataProtection: { ...DEFAULT_CONFIG.dataProtection, ...(raw.dataProtection ?? {}) },
      api:            { ...DEFAULT_CONFIG.api,            ...(raw.api            ?? {}) },
      audit:          { ...DEFAULT_CONFIG.audit,          ...(raw.audit          ?? {}) },
      compliance:     { ...DEFAULT_CONFIG.compliance,     ...(raw.compliance     ?? {}) },
    }
  } catch { return DEFAULT_CONFIG }
}

export function writeSecurityConfig(cfg: SecurityConfig): void {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2))
}

/** Compute a 0-100 security score from the current config (more enabled = higher). */
export function computeSecurityScore(cfg: SecurityConfig): { score: number; breakdown: Record<string, number> } {
  const breakdown = {
    authentication:
      (cfg.authentication.ssoEnabled         ? 4 : 0) +
      (cfg.authentication.mfaRequired        ? 6 : 0) +
      (cfg.authentication.passwordMinLength >= 12 ? 2 : 0) +
      (cfg.authentication.passwordRequireSpecial ? 2 : 0) +
      (cfg.authentication.passwordRotateDays > 0 && cfg.authentication.passwordRotateDays <= 90 ? 2 : 0),
    session:
      (cfg.session.timeoutMinutes <= 60 ? 4 : cfg.session.timeoutMinutes <= 120 ? 2 : 0) +
      (cfg.session.maxConcurrent  <= 5  ? 2 : 0) +
      (cfg.session.rememberMeAllowed ? 0 : 2),
    access:
      (cfg.access.ipAllowlistEnabled ? 5 : 0) +
      (cfg.access.rbacEnabled        ? 5 : 0),
    dataProtection:
      (cfg.dataProtection.encryptAtRest     ? 4 : 0) +
      (cfg.dataProtection.encryptInTransit  ? 4 : 0) +
      (cfg.dataProtection.piiDetection      ? 3 : 0) +
      (cfg.dataProtection.piiMaskingInLogs  ? 3 : 0) +
      (cfg.dataProtection.queryAuditEnabled ? 2 : 0),
    api:
      (cfg.api.keyRotationDays > 0 && cfg.api.keyRotationDays <= 90 ? 3 : 0) +
      (cfg.api.webhookSigning   ? 3 : 0) +
      (cfg.api.requireHttps     ? 3 : 0) +
      (cfg.api.rateLimitPerMinute > 0 ? 1 : 0),
    audit:
      (cfg.audit.retentionDays >= 365 ? 4 : cfg.audit.retentionDays >= 90 ? 2 : 0) +
      (cfg.audit.anomalyDetection      ? 3 : 0) +
      (cfg.audit.exportEnabled         ? 3 : 0),
    compliance:
      (cfg.compliance.soc2     ? 3 : 0) +
      (cfg.compliance.gdpr     ? 3 : 0) +
      (cfg.compliance.hipaa    ? 2 : 0) +
      (cfg.compliance.iso27001 ? 2 : 0),
  }
  const score = Math.min(100, Object.values(breakdown).reduce((s, n) => s + n, 0))
  return { score, breakdown }
}
