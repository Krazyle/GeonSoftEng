import { createContext } from "react";
import type PMap from "@/utils/pmap";

export const MapContext = createContext<PMap | null>(null);
