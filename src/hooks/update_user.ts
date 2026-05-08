import { atom, useAtom } from "jotai";

type User = any;

type MinimalUser = Pick<User, "areaUnits" | "lengthUnits">;
const userLikeAtom = atom<MinimalUser>({
  areaUnits: "meters",
  lengthUnits: "meters",
});

export function useUpdateMaybeUser() {
  const [userLike, setUserLike] = useAtom(userLikeAtom);

  return {
    user: userLike,
    setUser: (param: Partial<MinimalUser>) => {
      setUserLike((userLike) => {
        return {
          ...userLike,
          ...param,
        };
      });
    },
  };
}
