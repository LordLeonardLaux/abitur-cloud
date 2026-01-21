
const crypto = require('crypto');

function toBase64Url(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function sign(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = toBase64Url(JSON.stringify(header));
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    return `${signatureInput}.${signature}`;
}

const jwtSecret = crypto.randomBytes(32).toString('hex');
const dbPassword = crypto.randomBytes(16).toString('hex');
const dashboardPassword = crypto.randomBytes(16).toString('hex');

const anonPayload = {
    role: 'anon',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 315360000 // 10 years
};

const servicePayload = {
    role: 'service_role',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 315360000 // 10 years
};

const anonKey = sign(anonPayload, jwtSecret);
const serviceKey = sign(servicePayload, jwtSecret);

const envContent = `
# Supabase Configuration

# Postgres (Database)
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=postgres
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Supabase Studio
STUDIO_DEFAULT_ORGANIZATION=Default Organization
STUDIO_DEFAULT_PROJECT=Default Project
STUDIO_PORT=54323

# API Gateway (Kong)
KONG_HTTP_PORT=54321
KONG_HTTPS_PORT=54322

# Auth (GoTrue)
SITE_URL=http://localhost:3000
ADDITIONAL_REDIRECT_URLS=https://abiturcloud.com
JWT_SECRET=${jwtSecret}
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=fake_user
SMTP_PASS=fake_pass
SMTP_SENDER_NAME=Admin
API_EXTERNAL_URL=https://api.abiturcloud.com

# REST API (PostgREST)
PGRST_DB_SCHEMAS=public,storage,graphql_public

# Storage
STORAGE_BACKEND=file
FILE_STORAGE_BACKEND_PATH=/var/lib/storage
FILE_SIZE_LIMIT=52428800

# Keys
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}

# Others
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=${dashboardPassword}
LOGFLARE_PUBLIC_ACCESS_TOKEN=
LOGFLARE_PRIVATE_ACCESS_TOKEN=
IMGPROXY_ENABLE_WEBP_DETECTION=true
FUNCTIONS_VERIFY_JWT=false
SUPABASE_PUBLIC_URL=https://api.abiturcloud.com
`;

console.log(envContent);
