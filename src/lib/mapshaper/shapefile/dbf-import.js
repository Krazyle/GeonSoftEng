import { DataTable } from "../datatable/mapshaper-data-table";
import DbfReader from "../shapefile/dbf-reader";
import Dbf from "../shapefile/dbf-writer";

export function importDbfTable(buf, o) {
  var opts = o || {};
  return new ShapefileTable(buf, opts.encoding);
}

function ShapefileTable(buf, encoding) {
  var reader = new DbfReader(buf, encoding),
    altered = false,
    table;

  function getTable() {
    if (!table) {
      table = new DataTable(reader.readRows());
      reader = null;
      buf = null;
    }
    return table;
  }

  this.exportAsDbf = function (opts) {
    var useOriginal =
      !!reader && !altered && !opts.field_order && !opts.encoding;
    if (useOriginal) return reader.getBuffer();
    return Dbf.exportRecords(
      getTable().getRecords(),
      opts.encoding,
      opts.field_order,
    );
  };

  this.getReadOnlyRecordAt = function (i) {
    return reader ? reader.readRow(i) : table.getReadOnlyRecordAt(i);
  };

  this.deleteField = function (f) {
    if (table) {
      table.deleteField(f);
    } else {
      altered = true;
      reader.deleteField(f);
    }
  };

  this.getRecords = function () {
    return getTable().getRecords();
  };

  this.getFields = function () {
    return reader ? reader.getFields() : table.getFields();
  };

  this.isEmpty = function () {
    return reader ? this.size() === 0 : table.isEmpty();
  };

  this.size = function () {
    return reader ? reader.size() : table.size();
  };
}

Object.assign(ShapefileTable.prototype, DataTable.prototype);
