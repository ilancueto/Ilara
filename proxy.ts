import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';

/** Rutas públicas exactas: no requieren sesión y no deben redirigir a /login. */
const PUBLIC_EXACT_ROUTES = new Set(['/login', '/sitemap.xml', '/sitemap-xml', '/robots.txt']);

/** Rutas públicas por prefijo: el catálogo público incluye subrutas como /catalogo/p/[id]. */
const PUBLIC_PREFIX_ROUTES = ['/catalogo'];

function matchesRoutePrefix(pathname: string, route: string) {
    return pathname === route || pathname.startsWith(`${route}/`);
}

function isPublicRoute(pathname: string) {
    if (PUBLIC_EXACT_ROUTES.has(pathname)) {
        return true;
    }

    return PUBLIC_PREFIX_ROUTES.some((route) => matchesRoutePrefix(pathname, route));
}

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

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
        return NextResponse.redirect(new URL('/catalogo', request.url));
    }

    if (!user && !isPublicRoute(pathname)) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (user && pathname === '/login') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|swe-worker|~offline|sitemap\\.xml|sitemap-xml|robots\\.txt|.*\\.[^/]+$).*)',
    ],
};
