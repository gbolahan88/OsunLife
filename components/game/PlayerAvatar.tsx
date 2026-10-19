// components/game/PlayerAvatar.tsx
"use client";

import { CharacterAppearance, buildAvatarUrl } from "@/store/characterAppearance";

type PlayerAvatarProps = {
  appearance: CharacterAppearance;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export default function PlayerAvatar({
  appearance,
  size = 240,
  className = "",
  style,
}: PlayerAvatarProps) {
  const url = buildAvatarUrl(appearance, size);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Player character"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        ...style,
      }}
      draggable={false}
    />
  );
}