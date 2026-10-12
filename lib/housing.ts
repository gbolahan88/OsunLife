export type HousingPlanId = "self-con" | "room-parlour" | "two-bedroom";

// "undecided" = new player who hasn't seen / answered the rent pop-up yet
// "homeless"  = chose not to rent (or can't afford it) and sleeps under the bridge
export type HousingStatus = "undecided" | "homeless" | HousingPlanId;

export type HousingPlan = {
  id: HousingPlanId;
  name: string;
  price: number;
  emoji: string;
  blurb: string;
  features: string[];
};

export const HOUSING_PLANS: HousingPlan[] = [
  {
    id: "self-con",
    name: "Self-con",
    price: 350_000,
    emoji: "🚪",
    blurb: "One room with its own bathroom and a small kitchenette.",
    features: ["Studio room", "Bathroom", "Kitchenette"],
  },
  {
    id: "room-parlour",
    name: "Room & parlour self-con",
    price: 600_000,
    emoji: "🛋️",
    blurb: "A parlour for guests, a separate bedroom and a bathroom.",
    features: ["Parlour", "Bedroom", "Bathroom"],
  },
  {
    id: "two-bedroom",
    name: "2-bedroom flat",
    price: 1_500_000,
    emoji: "🏢",
    blurb: "Two bedrooms, living room, kitchen, utility room and a balcony.",
    features: ["2 bedrooms", "Living room", "Kitchen", "Utility", "Balcony"],
  },
];

// One-time starter loan offered to new players.
export const LOAN_OFFER = 500_000;

export function getHousingPlan(id: HousingPlanId): HousingPlan {
  return HOUSING_PLANS.find((plan) => plan.id === id) ?? HOUSING_PLANS[0];
}

export function isHousingPlanId(status: HousingStatus): status is HousingPlanId {
  return status !== "undecided" && status !== "homeless";
}