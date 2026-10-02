import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider
} from "react-router";
import Admin, { adminLoader } from "./Features/Admin";
import Preview, { previewLoader } from "./Features/Preview";
import AdminLayout from "./Layouts/AdminLayout";
import { DataError, DataLoading } from "./Features/components/DataStatus";

const dataRouteProps = {
  hydrateFallbackElement: <DataLoading />,
  errorElement: <DataError />
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AdminLayout />}>
      <Route
        path="/admin"
        element={<Admin />}
        loader={adminLoader}
        {...dataRouteProps}
      />
      <Route
        path="/preview"
        element={<Preview />}
        loader={previewLoader}
        {...dataRouteProps}
      />
    </Route>
  ),
  { basename: "/pong-playoff-tree-generator" }
);

export default function AdminApp() {
  return <RouterProvider router={router} />;
}
