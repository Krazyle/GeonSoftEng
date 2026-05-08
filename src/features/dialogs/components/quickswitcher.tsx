import { Combobox } from "@headlessui/react";
import { ArrowDownIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { LngLatBounds, type LngLatLike } from "maplibre-gl";
import { useContext, useMemo, useState } from "react";
import { Loading } from "@/components/elements";
import { useSingleActions } from "@/components/single_actions";
import { useActions } from "@/features/context_actions/components/geometry_actions";
import { useMultiActions } from "@/features/context_actions/components/multi_actions";
import {
  comboboxFooterClass,
  comboboxInputClass,
  ResultsOptions,
} from "@/features/dialogs/components/quickswitcher_shared";
import { useZoomTo } from "@/hooks/use_zoom_to";
import { MapContext } from "@/providers/map_context";
import { USelection } from "@/stores";
import {
  dataAtom,
  lastSearchResultAtom,
  searchHistoryAtom,
  selectionAtom,
} from "@/stores/jotai";
import {
  type GeocoderResults,
  geocodeEarth,
  type QItem,
} from "@/utils/geocode";
import { getColumns, getFn } from "@/utils/search_utils";

function featureToBounds(bbox: BBox4) {
  const [a, b, c, d] = bbox;
  return LngLatBounds.convert([
    [a, b],
    [c, d],
  ]);
}

const POI_ZOOM = 16;

export function QuickswitcherDialog({ onClose }: { onClose: () => void }) {
  const map = useContext(MapContext);
  const data = useAtomValue(dataAtom);
  const { featureMap } = data;
  const zoomTo = useZoomTo();

  const setSelection = useSetAtom(selectionAtom);
  const setLastSearchResult = useSetAtom(lastSearchResultAtom);
  const [searchHistory, setSearchHistory] = useAtom(searchHistoryAtom);
  const [query, setQuery] = useState<string>("");
  const [touched, setTouched] = useState<boolean>(false);
  const [historyCursor, setHistoryCursor] = useState<number>(0);

  const selectedFeatures = USelection.getSelectedFeatures(data);
  const actions = useActions(selectedFeatures);
  const multiActions = useMultiActions(selectedFeatures);
  const singleActions = useSingleActions(selectedFeatures);

  const searchIndex = useMemo(() => {
    const columns = getColumns({
      featureMap,
      folderId: null,
      virtualColumns: [],
    });
    return new Fuse(Array.from(featureMap.values()), {
      keys: columns,
      isCaseSensitive: false,
      includeMatches: true,
      getFn,
      threshold: 0.2,
      ignoreLocation: true,
    });
  }, [featureMap]);

  const {
    data: list,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["geocoder", query],
    queryFn: async ({ signal }) => {
      return geocodeEarth({
        query: query || "",
        center: map?.map.getCenter(),
        zoom: map?.map.getZoom(),
        signal,
        searchIndex,
        actions: actions.concat(multiActions).concat(singleActions),
      });
    },
    enabled: query.length > 2,
    placeholderData: (previousData, _previousQuery) => previousData,
  });

  function goToFeature(item: QItem) {
    if (!item || !map) return;

    const toCoords = (coordinates: LngLatLike) => {
      map.map.zoomTo(POI_ZOOM, { animate: false });
      map.map.setCenter(coordinates, {
        animate: false,
      });
    };

    const toBounds = (bounds: BBox4) => {
      map.map.fitBounds(featureToBounds(bounds), {
        animate: false,
      });
    };

    switch (item.type) {
      case "action": {
        void item.action.onSelect();
        break;
      }
      case "wrappedFeature": {
        setSelection(USelection.single(item.result.item.id));
        void zoomTo([item.result.item]);
        break;
      }
      case "coordinate": {
        toCoords(item.coordinates);
        setLastSearchResult(item);
        break;
      }
      case "Feature": {
        if (item.bbox) {
          toBounds(item.bbox as BBox4);
        } else {
          toCoords(item.geometry.coordinates as LngLatLike);
        }
        setLastSearchResult(item);
        break;
      }
      case "extent": {
        toBounds(item.coordinates);
        setLastSearchResult(item);
        break;
      }
      case "container":
      case "leaf": {
      }
    }
  }

  const geocoderResults = list?.geocoder || [];
  const literalResults = list?.literal || [];
  const featureResults = list?.features || [];
  const actionResults = list?.actions || [];

  return (
    <div aria-label="Search" className="relative w-full">
      <Combobox
        value={null}
        onChange={(item) => {
          if (query) {
            setSearchHistory((history) => {
              return [query].concat(history);
            });
          }
          if (item) {
            onClose();
            goToFeature(item);
          }
        }}
      >
        <Combobox.Input
          ref={(input: any) => {
            (input as HTMLInputElement)?.focus();
          }}
          onKeyUp={(e: any) => {
            switch (e.key) {
              case "Escape": {
                onClose();
                break;
              }
              case "ArrowUp": {
                if (!touched && searchHistory.length) {
                  const item = searchHistory[historyCursor];
                  if (item) {
                    setQuery(searchHistory[0]);
                    setHistoryCursor((i) => i + 1);
                    e.target.value = item;
                  }
                }
                break;
              }
            }
          }}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!touched) setTouched(true);
          }}
          spellCheck={false}
          id="search-geocoder"
          aria-label="Search"
          className={comboboxInputClass}
        />
        {isLoading || isError ? (
          <Loading />
        ) : (
          <Combobox.Options className="bg-white dark:bg-gray-900">
            <ResultsOptions results={actionResults} title="Actions" />
            <ResultsOptions results={literalResults} title="Literal" />
            <ResultsOptions results={geocoderResults} title="Geocoder" />
            <ResultsOptions results={featureResults} title="Features" />
          </Combobox.Options>
        )}
      </Combobox>

      <div className={comboboxFooterClass}>
        {hasResults(list) ? (
          <>
            <ArrowDownIcon /> Navigate options
            <div className="flex-auto text-right"></div>
          </>
        ) : (
          "Type to search…"
        )}
      </div>
    </div>
  );
}

function hasResults(results: GeocoderResults | undefined): boolean {
  if (!results) return false;
  return !!(
    results.features.length ||
    results.geocoder.length ||
    results.actions.length ||
    results.literal.length
  );
}
