import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate,
  RouterProvider
} from "react-router";
import Admin, { adminLoader } from "./Features/Admin";
import Preview, { previewLoader } from "./Features/Preview";
import AdminLayout from "./Layouts/AdminLayout";
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
          path="/public"
          element={<Preview />}
          loader={previewLoader}
          {...dataRouteProps}
        />
      </Route>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
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
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
