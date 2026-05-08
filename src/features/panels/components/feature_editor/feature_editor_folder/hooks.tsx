import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

export function useCustomSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );
}
