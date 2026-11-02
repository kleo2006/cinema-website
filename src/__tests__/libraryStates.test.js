import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CatalogProvider } from "../context/Catalog";
import { ToastProvider } from "../context/Toasts";
import { resetCatalogCache } from "../playback/catalog";
import Library from "../pages/Library";

const renderLibrary = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <CatalogProvider>
          <Library />
        </CatalogProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

const catalogResponse = (titles = {}) => ({ ok: true, status: 200, json: async () => ({ version: 1, titles }) });

beforeEach(() => resetCatalogCache());
afterEach(() => {
  delete global.fetch;
});

test("an empty but valid catalogue says no films are configured", async () => {
  global.fetch = jest.fn().mockResolvedValue(catalogResponse());
  renderLibrary();
  expect(await screen.findByText("No full films are configured yet")).toBeInTheDocument();
  expect(screen.queryByText("Couldn’t load the list of films")).not.toBeInTheDocument();
});

test("a catalogue that cannot be loaded is an error with a retry, not 'no films configured'", async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(catalogResponse());
  renderLibrary();
  expect(await screen.findByText("Couldn’t load the list of films")).toBeInTheDocument();
  expect(screen.queryByText("No full films are configured yet")).not.toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No full films are configured yet")).toBeInTheDocument();
  expect(screen.queryByText("Couldn’t load the list of films")).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test("a structurally broken catalogue is also an error, not an empty library", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ unexpected: true }) });
  renderLibrary();
  expect(await screen.findByText("Couldn’t load the list of films")).toBeInTheDocument();
});
