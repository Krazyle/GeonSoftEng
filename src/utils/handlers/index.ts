import type { HandlerContext } from "types";
import { Mode } from "@/stores/jotai";
import { useCircleHandlers } from "@/utils/handlers/circle";
import { useLassoHandlers } from "@/utils/handlers/lasso";
import { useLineHandlers } from "@/utils/handlers/line";
import { useNoneHandlers } from "@/utils/handlers/none";
import { usePointHandlers } from "@/utils/handlers/point";
import { usePolygonHandlers } from "@/utils/handlers/polygon";
import { useRectangleHandlers } from "@/utils/handlers/rectangle";
import { useRouteHandlers } from "@/utils/handlers/route";

export function useHandlers(handlerContext: HandlerContext) {
  const HANDLERS: Record<Mode, Handlers> = {
    [Mode.NONE]: useNoneHandlers(handlerContext),
    [Mode.DRAW_POINT]: usePointHandlers(handlerContext),
    [Mode.DRAW_LINE]: useLineHandlers(handlerContext),
    [Mode.DRAW_ROUTE]: useRouteHandlers(handlerContext),
    [Mode.DRAW_POLYGON]: usePolygonHandlers(handlerContext),
    [Mode.DRAW_RECTANGLE]: useRectangleHandlers(handlerContext),
    [Mode.DRAW_CIRCLE]: useCircleHandlers(handlerContext),
    [Mode.LASSO]: useLassoHandlers(handlerContext),
  };
  return HANDLERS;
}
