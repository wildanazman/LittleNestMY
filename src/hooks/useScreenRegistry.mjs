import { defaultScreenId, getScreenById, screens } from "../data/screens.mjs";

export function useScreenRegistry() {
  return {
    defaultScreen: getScreenById(defaultScreenId),
    getScreenById,
    screens
  };
}
