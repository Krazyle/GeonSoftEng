export function sortAts<T extends { at: string; id: string }>(
  a: T,
  b: T,
): number {
  if (a.at > b.at) {
    return 1;
  } else if (a.at < b.at) {
    return -1;
  } else if (a.id > b.id) {
    return 1;
  } else {
    return -1;
  }
}

export function sortByAt<T extends { at: string; id: string }>(list: T[]): T[] {
  return list.sort((a, b) => {
    if (a.at > b.at) {
      return 1;
    } else if (a.at < b.at) {
      return -1;
    } else if (a.id > b.id) {
      return 1;
    } else {
      return -1;
    }
  });
}
