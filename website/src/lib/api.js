import apiData from "../generated/api.json";

export const apiNavigation = apiData.navigation;
export const apiOverview = apiData.overview;
export const apiPages = apiData.pages;
export const apiPageList = Object.values(apiData.pages).filter(
  (page) => page.href !== "/api/types/",
).map((page) => ({
  primary: false,
  ...page,
}));
export const apiTypes = apiData.types;
export const apiExportsByGroup = apiData.exportsByGroup;
