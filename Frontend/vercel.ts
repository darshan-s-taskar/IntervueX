// Available only while Vercel evaluates its configuration, never in browser code.
const backend = process.env.BACKEND_ORIGIN
if (!backend) throw new Error('Set BACKEND_ORIGIN to the Render HTTPS origin before deploying.')
const url = new URL(backend)
if (url.protocol !== 'https:' || url.origin !== backend || !url.hostname.endsWith('.onrender.com')) {
    throw new Error('BACKEND_ORIGIN must be an exact https://<service>.onrender.com origin without a trailing slash.')
}

export const config = {
    framework: 'vite',
    installCommand: 'npm ci',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    rewrites: [
        { source: '/api/:path*', destination: `${backend}/api/:path*` },
        { source: '/((?!api(?:/|$)|assets/).*)', destination: '/index.html' },
    ],
    headers: [
        {
            source: '/api/:path*',
            headers: [{ key: 'Cache-Control', value: 'no-store' }],
        },
        {
            source: '/:path*',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
        },
    ],
}
