"use client";

import OsogboScene from "@/components/OsogboScene";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
} from "@/store/characterAppearance";

type OsogboWorldProps = {
  active: boolean;
  appearance?: CharacterAppearance;
  onEnterBuilding: (buildingName: string, buildingId: string) => void;
};

export default function OsogboWorld({
  active,
  appearance = DEFAULT_CHARACTER_APPEARANCE,
  onEnterBuilding,
}: OsogboWorldProps) {
  return (
    <OsogboScene
      active={active}
      appearance={appearance}
      onEnterBuilding={onEnterBuilding}
    />
  );
}