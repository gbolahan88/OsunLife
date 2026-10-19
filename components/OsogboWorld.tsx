"use client";

import OsogboScene from "@/components/OsogboScene";
import {
  CharacterAppearance,
  DEFAULT_CHARACTER_APPEARANCE,
} from "@/store/characterAppearance";

type OsogboWorldProps = {
  active: boolean;
  interactive?: boolean; 
  appearance?: CharacterAppearance;
  onEnterBuilding: (buildingName: string, buildingId: string) => void;
};

export default function OsogboWorld({
  active,
  interactive = true,
  appearance = DEFAULT_CHARACTER_APPEARANCE,
  onEnterBuilding,
}: OsogboWorldProps) {
  return (
    <OsogboScene
      active={active}
      interactive={interactive}
      appearance={appearance}
      onEnterBuilding={onEnterBuilding}
    />
  );
}