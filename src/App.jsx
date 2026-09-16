import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate,
  RouterProvider
} from "react-router";
import Admin from "./Admin";
import Preview, { previewLoader } from "./Preview";

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/preview" element={<Preview />} loader={previewLoader} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
