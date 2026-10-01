// Places to search. Each Generate searches the next area in the list, so repeat runs find new businesses.
// Towns with suburbs listed are searched suburb by suburb; the rest are searched as a whole town.
export const PROVINCES = {
  Gauteng: {
    Johannesburg: [
      'Sandton', 'Randburg', 'Rosebank', 'Soweto', 'Fourways', 'Midrand', 'Roodepoort', 'Bryanston', 'Melville',
      'Johannesburg CBD', 'Northcliff', 'Parktown', 'Rivonia', 'Sunninghill', 'Linden', 'Lenasia', 'Alexandra',
      'Kensington', 'Houghton', 'Diepsloot',
    ],
    Pretoria: [
      'Pretoria CBD', 'Centurion', 'Hatfield', 'Menlyn', 'Brooklyn', 'Lynnwood', 'Sunnyside', 'Arcadia', 'Montana',
      'Wonderboom', 'Garsfontein', 'Faerie Glen', 'Silverton', 'Mamelodi', 'Atteridgeville', 'Soshanguve',
    ],
    Ekurhuleni: ['Benoni', 'Boksburg', 'Germiston', 'Kempton Park', 'Alberton', 'Edenvale', 'Springs', 'Brakpan', 'Tembisa'],
    'West Rand': ['Krugersdorp', 'Randfontein', 'Mogale City'],
    Vereeniging: [],
    Vanderbijlpark: [],
  },
  'Western Cape': {
    'Cape Town': [
      'Cape Town CBD', 'Sea Point', 'Claremont', 'Bellville', 'Observatory', 'Durbanville', 'Table View', 'Woodstock',
      'Rondebosch', 'Gardens', 'Green Point', 'Parow', 'Goodwood', 'Milnerton', 'Somerset West', 'Strand', 'Wynberg',
      'Kenilworth', 'Mitchells Plain', 'Khayelitsha',
    ],
    Stellenbosch: [],
    Paarl: [],
    George: [],
    'Mossel Bay': [],
    Knysna: [],
    Hermanus: [],
    Worcester: [],
  },
  'KwaZulu-Natal': {
    Durban: [
      'Durban CBD', 'Umhlanga', 'Berea', 'Morningside', 'Westville', 'Pinetown', 'Durban North', 'Glenwood', 'Musgrave',
      'Hillcrest', 'Ballito', 'Chatsworth', 'Phoenix', 'Umlazi', 'KwaMashu', 'Amanzimtoti',
    ],
    Pietermaritzburg: [],
    'Richards Bay': [],
    Newcastle: [],
    'Port Shepstone': [],
    Ladysmith: [],
  },
  'Eastern Cape': {
    Gqeberha: ['Gqeberha Central', 'Summerstrand', 'Walmer', 'Newton Park', 'Humewood', 'Kabega Park', 'Motherwell', 'Uitenhage'],
    'East London': ['East London CBD', 'Vincent', 'Beacon Bay', 'Nahoon', 'Gonubie'],
    Mthatha: [],
    Makhanda: [],
    'Jeffreys Bay': [],
    Komani: [],
  },
  'Free State': {
    Bloemfontein: ['Bloemfontein CBD', 'Westdene', 'Brandwag', 'Langenhovenpark', 'Bayswater', 'Universitas', 'Mangaung'],
    Welkom: [],
    Bethlehem: [],
    Kroonstad: [],
    Sasolburg: [],
    Parys: [],
  },
  Limpopo: {
    Polokwane: [],
    Tzaneen: [],
    Mokopane: [],
    Thohoyandou: [],
    Makhado: [],
    'Bela-Bela': [],
    Lephalale: [],
  },
  Mpumalanga: {
    Mbombela: [],
    eMalahleni: [],
    Middelburg: [],
    Secunda: [],
    Ermelo: [],
    'White River': [],
    Hazyview: [],
  },
  'North West': {
    Rustenburg: [],
    Mahikeng: [],
    Potchefstroom: [],
    Klerksdorp: [],
    Brits: [],
    Hartbeespoort: [],
  },
  'Northern Cape': {
    Kimberley: [],
    Upington: [],
    Springbok: [],
    Kuruman: [],
    'De Aar': [],
  },
};

export const ALL_SA = 'All of South Africa';

export const BUSINESS_TYPES = [
  'beauty salons', 'nail salons', 'hair salons', 'barbers', 'lash and brow bars', 'spas',
  'gyms', 'personal trainers', 'tattoo studios', 'car washes', 'plumbers', 'electricians',
];

const norm = (s) => String(s ?? '').toLowerCase().trim();

// Takes one item from each list in turn: [[a1,a2],[b1]] → [a1,b1,a2]. Spreads searches across towns.
function interleave(lists) {
  const out = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

function townAreas(province, town) {
  const suburbs = PROVINCES[province][town];
  if (suburbs.length) return suburbs.map((s) => ({ label: `${s}, ${town}`, query: `${s}, ${town}, South Africa` }));
  return [{ label: `${town}, ${province}`, query: `${town}, ${province}, South Africa` }];
}

const provinceAreas = (province) => interleave(Object.keys(PROVINCES[province]).map((t) => townAreas(province, t)));

const findProvince = (name) => Object.keys(PROVINCES).find((p) => norm(p) === norm(name));

function findTown(name, province) {
  for (const p of province ? [province] : Object.keys(PROVINCES)) {
    const town = Object.keys(PROVINCES[p]).find((t) => norm(t) === norm(name));
    if (town) return { province: p, town };
  }
  return null;
}

// Works out which areas a search covers, from a province + town picked on the website,
// or from a typed place name (which can also be a province or town we know).
export function resolveScope({ province, town, location } = {}) {
  const typed = String(location ?? '').trim();
  if (typed) {
    if (norm(typed) === norm(ALL_SA) || norm(typed) === 'south africa') return resolveScope({ province: ALL_SA });
    const p = findProvince(typed);
    if (p) return resolveScope({ province: p });
    const t = findTown(typed);
    if (t) return resolveScope(t);
    const query = /south africa/i.test(typed) ? typed : `${typed}, South Africa`;
    return { key: `place:${norm(typed)}`, areas: [{ label: typed, query }] };
  }
  if (norm(province) === norm(ALL_SA)) {
    return { key: 'all', areas: interleave(Object.keys(PROVINCES).map(provinceAreas)) };
  }
  const p = findProvince(province);
  if (!p) return null;
  if (town) {
    const t = findTown(town, p);
    if (!t) return null;
    return { key: `town:${norm(p)}/${norm(t.town)}`, areas: townAreas(p, t.town) };
  }
  return { key: `province:${norm(p)}`, areas: provinceAreas(p) };
}
