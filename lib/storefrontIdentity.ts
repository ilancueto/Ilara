/** Public, owner-confirmed business identity. Never add private account data here. */
export const ILARA_INSTAGRAM_URL = 'https://www.instagram.com/ilara__beauty/'

export function buildIlaraOrganization(siteOrigin: string) {
  const origin = siteOrigin.replace(/\/$/, '')
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'Ilara Beauty',
    alternateName: 'Ilara',
    url: origin,
    logo: `${origin}/logo-header.png`,
    description: 'Emprendimiento de maquillaje, skincare y cosmética en Neuquén, Argentina. Fundado por Mara y acompañado por Ilan Cueto como cofundador y responsable de tecnología.',
    email: ['mara.baidal@ilara.com.ar', 'ilan.cueto@ilara.com.ar'],
    sameAs: [ILARA_INSTAGRAM_URL],
    founder: [
      { '@type': 'Person', name: 'Mara', jobTitle: 'Fundadora' },
      { '@type': 'Person', name: 'Ilan Cueto', jobTitle: 'Cofundador y responsable de tecnología' },
    ],
    location: { '@type': 'Place', name: 'Neuquén, Argentina' },
  }
}
