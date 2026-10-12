export type MapTask = {
  id: string;
  title: string;
  targetBuildingId: string;
  targetBuildingName: string;
  reward: number;
};

export const MAP_TASK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const MAP_TASKS: MapTask[] = [
  {
    id: "market-delivery",
    title: "Deliver market supplies",
    targetBuildingId: "market",
    targetBuildingName: "Oja Oba Market",
    reward: 90_000,
  },
  {
    id: "stadium-setup",
    title: "Help prepare the stadium",
    targetBuildingId: "stadium",
    targetBuildingName: "Osogbo City Stadium",
    reward: 80_000,
  },
  {
    id: "meal-pickup",
    title: "Pick up a kitchen order",
    targetBuildingId: "restaurant",
    targetBuildingName: "Alahja Alamala's Kitchen",
    reward: 75_000,
  },
  {
    id: "mall-parcel",
    title: "Collect a parcel",
    targetBuildingId: "mall",
    targetBuildingName: "Osun Mall",
    reward: 75_000,
  },
  {
    id: "hospital-supplies",
    title: "Drop off clinic supplies",
    targetBuildingId: "hospital",
    targetBuildingName: "City Hospital",
    reward: 80_000,
  },
];