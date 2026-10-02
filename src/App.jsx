import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider
} from "react-router";
import Preview, { previewLoader } from "./Features/Preview";
import PublicLayout from "./Layouts/PublicLayout";
import { DataError, DataLoading } from "./Features/components/DataStatus";

const dataRouteProps = {
  hydrateFallbackElement: <DataLoading />,
  errorElement: <DataError />
};

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={<Preview />}
          loader={previewLoader}
          {...dataRouteProps}
        />
      </Route>
    </>
  ),
  {
    basename: "/pong-playoff-tree-generator"
  }
);

export default function App() {
  return <RouterProvider router={router} />;
}
