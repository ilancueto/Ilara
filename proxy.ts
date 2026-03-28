import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getEnv } from '@/lib/env';

/** Rutas sin sesión: SEO (sitemap/robots deben ser XML/texto, no HTML de /login). */
const PUBLIC_ROUTES = ['/login', '/catalogo', '/sitemap.xml', '/robots.txt'];

/** Next.js 16+: sustituye la convención `middleware` (renombrada a `proxy`). */
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        getEnv('NEXT_PUBLIC_SUPABASE_URL'),
        getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: Record<string, unknown>) {
                    request.cookies.set({ name, value, ...options });
                    response = NextResponse.next({ request });
                    response.cookies.set({ name, value, ...options });
                },
                remove(name: string, options: Record<string, unknown>) {
                    request.cookies.set({ name, value: '', ...options });
                    response = NextResponse.next({ request });
                    response.cookies.set({ name, value: '', ...options });
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const pathname = request.nextUrl.pathname;
    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

    if (!user && pathname === '/') {
        return NextResponse.redirect(new URL('/catalogo', request.url));
    }
    if (!user && !isPublicRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (user && pathname === '/login') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|swe-worker|~offline|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
