import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { createRequestId } from '@/lib/observability';

/** Rutas públicas exactas: no requieren sesión y no deben redirigir a /login. */
const PUBLIC_EXACT_ROUTES = new Set([
    '/login',
    '/sitemap.xml',
    '/sitemap-xml',
    '/robots.txt',
    '/api/internal/expire-payments',
]);

/** Rutas públicas por prefijo: el catálogo público incluye subrutas como /catalogo/p/[id]. */
const PUBLIC_PREFIX_ROUTES = ['/catalogo', '/pedido'];

const REQUEST_ID_HEADER = 'x-request-id';

function matchesRoutePrefix(pathname: string, route: string) {
    return pathname === route || pathname.startsWith(`${route}/`);
}

function isPublicRoute(pathname: string) {
    if (PUBLIC_EXACT_ROUTES.has(pathname)) {
        return true;
    }

    return PUBLIC_PREFIX_ROUTES.some((route) => matchesRoutePrefix(pathname, route));
}

function resolveRequestId(request: NextRequest): string {
    const incoming =
        request.headers.get(REQUEST_ID_HEADER) ||
        request.headers.get('x-correlation-id');
    if (incoming && incoming.length <= 128 && /^[\w\-.:]+$/.test(incoming)) {
        return incoming;
    }
    return createRequestId();
}

function attachRequestId(response: NextResponse, requestId: string): NextResponse {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
}

export async function proxy(request: NextRequest) {
    const requestId = resolveRequestId(request);
    let response = NextResponse.next({ request });
    attachRequestId(response, requestId);

    const supabase = createServerClient(
        getEnv('NEXT_PUBLIC_SUPABASE_URL'),
        getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    response = NextResponse.next({ request });
                    attachRequestId(response, requestId);

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    if (!user && pathname === '/') {
        const redirect = NextResponse.redirect(new URL('/catalogo', request.url));
        return attachRequestId(redirect, requestId);
    }

    if (!user && !isPublicRoute(pathname)) {
        const redirect = NextResponse.redirect(new URL('/login', request.url));
        return attachRequestId(redirect, requestId);
    }

    if (user && pathname === '/login') {
        const redirect = NextResponse.redirect(new URL('/', request.url));
        return attachRequestId(redirect, requestId);
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|swe-worker|~offline|sitemap\\.xml|sitemap-xml|robots\\.txt|.*\\.[^/]+$).*)',
    ],
};
