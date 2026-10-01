import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

// Hosts that mean "this business has no real website of its own".
const SOCIAL_HOSTS = [
  'facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
  'linktr.ee', 'linkin.bio', 'wa.me', 'whatsapp.com', 'booksy.com', 'fresha.com',
  'google.com', 'business.site', 'g.page', 'sites.google.com',
];

const WHATSAPP_HOSTS = ['wa.me', 'whatsapp.com'];

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

const matchesHost = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`));

// 'none' | 'social' | 'website'
export function websiteKind(url) {
  if (!url) return 'none';
  return matchesHost(hostOf(url), SOCIAL_HOSTS) ? 'social' : 'website';
}

// Google doesn't say whether a number is on WhatsApp. We use the best signals available:
//  - "Confirmed": the listing links to wa.me / whatsapp.com
//  - "Likely":    the number is a mobile number (almost all mobile numbers in e.g. ZA are on WhatsApp)
//  - "No":        landline / unknown number type, or no number at all
export function whatsappStatus(place, defaultCountry) {
  if (matchesHost(hostOf(place.websiteUri), WHATSAPP_HOSTS)) return 'Confirmed';
  const phone = parsePhone(place, defaultCountry);
  if (!phone) return 'No';
  const type = phone.getType();
  return type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE' ? 'Likely' : 'No';
}

function parsePhone(place, defaultCountry) {
  const raw = place.internationalPhoneNumber || place.nationalPhoneNumber;
  if (!raw) return undefined;
  const phone = parsePhoneNumberFromString(raw, defaultCountry);
  return phone?.isValid() ? phone : undefined;
}

export function toLead(place, { search, defaultCountry }) {
  const phone = parsePhone(place, defaultCountry);
  const wa = whatsappStatus(place, defaultCountry);
  const digits = phone ? phone.number.replace('+', '') : '';
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    category: place.primaryTypeDisplayName?.text ?? '',
    phone: phone ? phone.formatInternational() : (place.nationalPhoneNumber ?? ''),
    whatsapp: wa,
    whatsappLink: wa !== 'No' && digits ? `https://wa.me/${digits}` : '',
    socialLink: websiteKind(place.websiteUri) === 'social' ? place.websiteUri : '',
    address: place.formattedAddress ?? '',
    rating: place.rating ?? '',
    reviews: place.userRatingCount ?? 0,
    mapsUrl: place.googleMapsUri ?? '',
    search,
    foundOn: new Date().toISOString().slice(0, 10),
  };
}

// Returns a reason string if the place should be skipped, otherwise null.
export function rejectReason(place, { includeSocial = true, requireWhatsapp = true, minRating = 0, minReviews = 0, defaultCountry }) {
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') return 'not operational';
  const kind = websiteKind(place.websiteUri);
  if (kind === 'website') return 'has website';
  if (kind === 'social' && !includeSocial) return 'has social page';
  if (!place.nationalPhoneNumber && !place.internationalPhoneNumber) return 'no phone';
  if (requireWhatsapp && whatsappStatus(place, defaultCountry) === 'No') return 'no WhatsApp';
  if (minRating && !(place.rating >= minRating)) return 'rating too low';
  if (minReviews && !((place.userRatingCount ?? 0) >= minReviews)) return 'too few reviews';
  return null;
}
