import { compileCalcExpression } from "../commands/mapshaper-calc";

export function getJoinCalc(src, exp) {
  var calc = compileCalcExpression({ data: src }, null, exp);
  return function (ids, destRec) {
    if (!ids) ids = [];
    calc(ids, destRec);
  };
}
