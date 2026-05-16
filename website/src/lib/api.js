const REPO_URL = "https://github.com/GazaliAhmad/causal-order/blob/main";

export const apiNavigation = [
  {
    title: "Reference",
    items: [
      { title: "Overview", href: "/api/" },
      { title: "orderEvents()", href: "/api/order-events/" },
      { title: "orderEventStream()", href: "/api/order-event-stream/" },
      { title: "validateEvent()", href: "/api/validate-event/" },
      { title: "compareByCausality()", href: "/api/compare-by-causality/" },
      { title: "Types", href: "/api/types/" },
    ],
  },
];

export const apiSourceUrls = {
  overview: `${REPO_URL}/src/index.ts`,
  orderEvents: `${REPO_URL}/src/order/orderEvents.ts`,
  orderEventStream: `${REPO_URL}/src/order/orderEventStream.ts`,
  validateEvent: `${REPO_URL}/src/validate/validateEvent.ts`,
  compareByCausality: `${REPO_URL}/src/compare/causalCompare.ts`,
  types: `${REPO_URL}/src/types.ts`,
};
