import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // WordPress usava /ezequiel/ — normaliza para /ezequiel e a rota $barberSlug resolve.
    trailingSlash: "never",
  });

  return router;
};
