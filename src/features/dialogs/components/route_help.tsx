import { CommitIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "@/components/dialog";
import { styledInlineA } from "@/components/elements";

export function RouteHelpDialog() {
  return (
    <>
      <DialogHeader title="Route help" titleIcon={CommitIcon} />
      <div>
        <p className="mt-2">
          Draw a route by clicking <CommitIcon className="w-4 inline-block" />{" "}
          and clicking on the map to add a waypoint. Using the menu to the right
          of the block, you can customize whether the route using walking,
          driving, or cycling profiles.
        </p>
        <p className="mt-2">
          Routes are represented as GeometryCollection objects with points for
          waypoints and a linestring for the route. They're currently generated
          by the Mapbox Directions API.
        </p>
        <p>
          <h2 className="mt-8 font-bold">Known limitations</h2>
          <ul className="list-disc ml-6 mt-2">
            <li>
              You can't add control points to the middle of routes, or extend
              routes once they've been drawn.
            </li>
            <li>
              Other than doing 'Split GeometryCollection', there is not a very
              intuitive way to turn a route into a normal LineString.
            </li>
          </ul>
        </p>
      </div>
    </>
  );
}
