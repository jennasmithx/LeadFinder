// Each Generate searches the next suburb in the list, so repeat runs find new businesses.
export const CITIES = {
  Johannesburg: [
    'Sandton', 'Randburg', 'Rosebank', 'Soweto', 'Fourways', 'Midrand', 'Roodepoort', 'Bryanston', 'Melville',
    'Johannesburg CBD', 'Northcliff', 'Parktown', 'Rivonia', 'Sunninghill', 'Linden', 'Lenasia', 'Alexandra',
    'Kensington', 'Houghton', 'Diepsloot',
  ],
  'Cape Town': [
    'Cape Town CBD', 'Sea Point', 'Claremont', 'Bellville', 'Observatory', 'Durbanville', 'Table View', 'Woodstock',
    'Rondebosch', 'Gardens', 'Green Point', 'Parow', 'Goodwood', 'Milnerton', 'Somerset West', 'Strand', 'Wynberg',
    'Kenilworth', 'Mitchells Plain', 'Khayelitsha',
  ],
  Durban: [
    'Durban CBD', 'Umhlanga', 'Berea', 'Morningside', 'Westville', 'Pinetown', 'Durban North', 'Glenwood', 'Musgrave',
    'Hillcrest', 'Ballito', 'Chatsworth', 'Phoenix', 'Umlazi', 'KwaMashu', 'Amanzimtoti',
  ],
  Pretoria: [
    'Pretoria CBD', 'Centurion', 'Hatfield', 'Menlyn', 'Brooklyn', 'Lynnwood', 'Sunnyside', 'Arcadia', 'Montana',
    'Wonderboom', 'Garsfontein', 'Faerie Glen', 'Silverton', 'Mamelodi', 'Atteridgeville', 'Soshanguve',
  ],
};

export const BUSINESS_TYPES = [
  'beauty salons', 'nail salons', 'hair salons', 'barbers', 'lash and brow bars', 'spas',
  'gyms', 'personal trainers', 'tattoo studios', 'car washes', 'plumbers', 'electricians',
];
