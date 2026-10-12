"use client";

import OsogboScene from "./OsogboScene";

export default function OsogboWorld({
  active,
  interactive = true,
  onEnterBuilding,
}: {
  active: boolean;
  interactive?: boolean;
  onEnterBuilding: (buildingName: string, buildingId: string) => void;
}) {
  return <OsogboScene active={active} interactive={interactive} onEnterBuilding={onEnterBuilding} />;
}
