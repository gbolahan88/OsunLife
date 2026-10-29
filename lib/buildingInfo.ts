// lib/buildingInfo.ts

export type TransportId = "trek" | "danfo" | "keke" | "okada" | "taxi";

export type TransportMode = {
  id: TransportId;
  name: string;
  emoji: string;
  /** Naira taken from the player's cash when they press Go. 0 = free. */
  price: number;
  /** Map units per second. Bigger = faster trip. */
  speed: number;
};

export const TRANSPORT_MODES: TransportMode[] = [
  { id: "trek", name: "Trek", emoji: "🚶", price: 0, speed: 120 },
  { id: "danfo", name: "Danfo", emoji: "🚌", price: 500, speed: 300 },
  { id: "keke", name: "Keke", emoji: "🛺", price: 800, speed: 360 },
  { id: "okada", name: "Okada", emoji: "🏍️", price: 1500, speed: 520 },
  { id: "taxi", name: "Taxi", emoji: "🚕", price: 3000, speed: 760 },
];

export type BuildingInfo = {
  area: string;
  blurb: string;
  tags: string[];
};

export const FALLBACK_INFO: BuildingInfo = {
  area: "Osogbo",
  blurb: "A place in Osogbo worth a visit.",
  tags: [],
};

export const BUILDING_INFO: Record<string, BuildingInfo> = {
  home: {
    area: "Your neighbourhood",
    blurb: "Your own place. Rest, eat, shower and arrange the furniture however you like.",
    tags: ["Sleep", "Cook", "Shower", "Buy furniture"],
  },
  uniosun: {
    area: "Osogbo",
    blurb: "The UNIOSUN campus: lecture halls, a busy quad and students rushing between classes.",
    tags: ["Classrooms", "Study", "Meet students"],
  },
  stadium: {
    area: "Osogbo",
    blurb: "The city stadium. Matches, training sessions and big weekend events happen here.",
    tags: ["Sports", "Events", "Gym"],
  },
  hospital: {
    area: "Osogbo",
    blurb: "The city hospital. Clinics, wards and a pharmacy for anything that ails you.",
    tags: ["Clinic", "Pharmacy", "Wards"],
  },
  palace: {
    area: "Ota-Efun",
    blurb: "The Ataoja's palace, the seat of Osogbo's royal tradition. Visitors are received in the reception hall.",
    tags: ["Culture", "Royal court", "History"],
  },
  market: {
    area: "Oja Oba",
    blurb: "Osogbo's living marketplace. Fresh produce, provisions, herbs and hot street food, all haggled over loudly.",
    tags: ["Groceries", "Street food", "Herbs", "Provisions"],
  },
  "adire-tower": {
    area: "Osogbo",
    blurb: "Nike's Gallery, a tower of art and adire fashion crafted in Osogbo.",
    tags: ["Art gallery", "Adire fashion", "Shopping"],
  },
  "civic-tower": {
    area: "Osogbo",
    blurb: "Osun's civic administration office. Permits, paperwork and public services.",
    tags: ["Government", "Offices", "Paperwork"],
  },
  "bank-tower": {
    area: "Oroki",
    blurb: "Oroki Heights, a business tower with offices and banking services.",
    tags: ["Banking", "Offices", "Business"],
  },
  "grove-gate": {
    area: "Osun Grove",
    blurb: "The visitor centre at the gate of the sacred Osun-Osogbo grove. Quiet, green and full of shrines.",
    tags: ["Sacred grove", "Shrines", "Nature"],
  },
  "bus-stop": {
    area: "Osogbo",
    blurb: "The central mosque and its prayer hall, a calm place in the middle of the city.",
    tags: ["Prayer hall", "Community"],
  },
  shop1: {
    area: "Osogbo",
    blurb: "A neighbourhood convenience shop with shelves of everyday essentials.",
    tags: ["Snacks", "Drinks", "Essentials"],
  },
  barber: {
    area: "Osogbo",
    blurb: "Fresh Cut barbershop. Sharp lines, loud music and plenty of gist.",
    tags: ["Haircut", "Gist", "Grooming"],
  },
  restaurant: {
    area: "Osogbo",
    blurb: "Alahja Alamala's Kitchen. Rice, amala, soups and proper home cooking.",
    tags: ["Amala", "Jollof", "Soups", "Eat in"],
  },
  mall: {
    area: "Osogbo",
    blurb: "Osun Mall. Shops, clothes and a place to hang out with friends.",
    tags: ["Shopping", "Fashion", "Hang out"],
  },
  garage: {
    area: "Osogbo",
    blurb: "The mechanic garage. Cars up on lifts, engines on the floor and spare parts everywhere.",
    tags: ["Repairs", "Spare parts", "Cars"],
  },
  berrymist: {
    area: "Osogbo",
    blurb: "BerryMist Lounge. An open-air bar with cocktails, bar stools and soft lights.",
    tags: ["Cocktails", "Open bar", "Chill"],
  },
  "circle-lounge": {
    area: "Osogbo",
    blurb: "Circle Lounge. A premium open bar with a gold-lit counter and umbrella tables.",
    tags: ["Premium bar", "Cocktails", "Lounge"],
  },
  "zeus-club": {
    area: "Osogbo",
    blurb: "Zeus Club. Lights, music and a dance floor that stays full till late.",
    tags: ["Dance floor", "Nightlife", "Music"],
  },
  okefia: {
    area: "Okefia",
    blurb: "The Okefia flyover. The shelter underneath is where people with nowhere else sleep.",
    tags: ["Flyover", "Rough sleep"],
  },
  olaiya: {
    area: "Olaiya",
    blurb: "The Olaiya flyover. A busy junction with a rest point underneath.",
    tags: ["Flyover", "Rest point"],
  },
};