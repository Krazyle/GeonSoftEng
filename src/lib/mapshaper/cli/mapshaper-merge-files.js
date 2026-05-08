import { mergeDatasets } from "../dataset/mapshaper-merging";
import { importFile } from "../io/mapshaper-file-import";
import { cleanPathsAfterImport } from "../paths/mapshaper-path-import";
import { buildTopology } from "../topology/mapshaper-topology";
import utils from "../utils/mapshaper-utils";

export function importFiles(files, opts) {
  var unbuiltTopology = false;
  var datasets = files.map(function (fname) {
    var importOpts = utils.defaults(
      { no_topology: true, snap: false, snap_interval: null, files: [fname] },
      opts,
    );
    var dataset = importFile(fname, importOpts);

    if (
      dataset.arcs &&
      dataset.arcs.size() > 0 &&
      dataset.info.input_formats[0] !== "topojson"
    ) {
      unbuiltTopology = true;
    }
    return dataset;
  });
  var combined = mergeDatasets(datasets);

  if (unbuiltTopology && !opts.no_topology) {
    cleanPathsAfterImport(combined, opts);
    buildTopology(combined);
  }
  return combined;
}
