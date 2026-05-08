import { getAntimeridian } from "../geom/mapshaper-latlon";

export function getCrsSlug(P) {
  return P.params.proj.param;
}

export function isRotatedNormalProjection(P) {
  return isAxisAligned(P) && P.lam0 !== 0;
}

export function isAxisAligned(P) {
  if (
    inList(
      P,
      "cassini,gnom,bertin1953,chamb,ob_tran,tpeqd,healpix,rhealpix," +
        "ocea,omerc,tmerc,etmerc",
    )
  ) {
    return false;
  }
  if (isAzimuthal(P)) {
    return false;
  }
  return true;
}

function _getBoundingMeridian(P) {
  if (P.lam0 === 0) return 180;
  return getAntimeridian((P.lam0 * 180) / Math.PI);
}

export function isMeridianBounded(P) {
  return isAxisAligned(P);
}

function _isParallelBounded(P) {
  return isAxisAligned(P);
}

function _isConic(P) {
  return inList(
    P,
    "aea,bonne,eqdc,lcc,poly,euler,murd1,murd2,murd3,pconic,tissot,vitk1",
  );
}

function isAzimuthal(P) {
  return inList(
    P,
    "aeqd,gnom,laea,mil_os,lee_os,gs48,alsk,gs50,nsper,tpers,ortho,qsc,stere,ups,sterea",
  );
}

export function inList(P, str) {
  return str.split(",").includes(getCrsSlug(P));
}
