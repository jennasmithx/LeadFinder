// Suburbs are used with the Google source, which caps each search at 60 results.
// Apify searches the whole city at once, so it only needs the city name.
export const CITIES = {
  Johannesburg: ['Sandton', 'Randburg', 'Rosebank', 'Fourways', 'Bryanston', 'Midrand', 'Roodepoort', 'Soweto', 'Melville', 'Johannesburg CBD'],
  'Cape Town': ['Cape Town CBD', 'Sea Point', 'Claremont', 'Observatory', 'Bellville', 'Durbanville', 'Table View', 'Somerset West', 'Mitchells Plain', 'Khayelitsha'],
  Durban: ['Durban CBD', 'Umhlanga', 'Berea', 'Morningside', 'Westville', 'Pinetown', 'Ballito', 'Chatsworth', 'Umlazi', 'Amanzimtoti'],
  Pretoria: ['Pretoria CBD', 'Centurion', 'Hatfield', 'Menlyn', 'Brooklyn', 'Sunnyside', 'Montana', 'Mamelodi'],
};

export const BUSINESS_TYPES = [
  'beauty salons', 'nail salons', 'hair salons', 'barbers', 'lash and brow bars', 'spas',
  'gyms', 'personal trainers', 'tattoo studios', 'car washes', 'plumbers', 'electricians',
];
