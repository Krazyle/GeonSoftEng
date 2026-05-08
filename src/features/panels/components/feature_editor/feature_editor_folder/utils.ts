import type { VirtualItem } from "@tanstack/react-virtual";

export function virtualPosition(
  virtualRow: VirtualItem,
): NonNullable<React.HTMLAttributes<HTMLDivElement>["style"]> {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: `100%`,
    height: `${virtualRow.size}px`,
    transform: `translate(0px, ${virtualRow.start}px)`,
  };
}
