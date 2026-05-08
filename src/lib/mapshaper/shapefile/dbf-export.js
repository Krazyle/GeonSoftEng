import { DataTable } from "../datatable/mapshaper-data-table";
import Dbf from "../shapefile/dbf-writer";
import utils from "../utils/mapshaper-utils";

export function exportDbf(dataset, opts) {
  return dataset.layers.reduce(function (files, lyr) {
    if (lyr.data) {
      files = files.concat(exportDbfFile(lyr, dataset, opts));
    }
    return files;
  }, []);
}

export function exportDbfFile(lyr, _dataset, opts) {
  var data = lyr.data,
    buf;

  if (!data || opts.cut_table || opts.drop_table) {
    data = new DataTable(lyr.shapes ? lyr.shapes.length : 0);
  }

  if (data.isEmpty()) {
    data.addIdField();
  }
  if (data.exportAsDbf) {
    buf = data.exportAsDbf(opts);
  } else {
    buf = Dbf.exportRecords(data.getRecords(), opts.encoding, opts.field_order);
  }
  if (utils.isInteger(opts.ldid)) {
    new Uint8Array(buf)[29] = opts.ldid;
  }

  return [
    {
      content: buf,
      filename: `${lyr.name}.dbf`,
    },
  ];
}
