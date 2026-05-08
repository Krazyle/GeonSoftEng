import cmd from "../mapshaper-cmd";
import { error } from "../utils/mapshaper-logging";
import utils from "../utils/mapshaper-utils";

export function getLayerSelection(lyr, arcs, opts) {
  var lyr2 = utils.extend({}, lyr);
  var filterOpts = {
    expression: opts.where,
    invert: !!opts.invert,
    verbose: false,
    no_replace: opts.no_replace,
  };
  return cmd.filterFeatures(lyr2, arcs, filterOpts);
}

export function applyCommandToLayerSelection(commandFunc, lyr, arcs, opts) {
  if (!opts?.where) {
    error('Missing required "where" parameter');
  }
  var subsetLyr = getLayerSelection(lyr, arcs, opts);
  var cmdOpts = utils.defaults({ where: null }, opts);
  var outputLyr = commandFunc(subsetLyr, arcs, cmdOpts);
  var filterOpts = utils.defaults({ invert: true }, opts);
  var filteredLyr = getLayerSelection(lyr, arcs, filterOpts);
  var merged = cmd.mergeLayers([filteredLyr, outputLyr], {
    verbose: false,
    force: true,
  });
  return merged[0];
}
