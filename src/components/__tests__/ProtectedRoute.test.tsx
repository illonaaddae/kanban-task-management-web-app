import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useStore } from "../../store/store";
import { ProtectedRoute } from "../ProtectedRoute";

function TestComponent() {
  return <div>Protected Content</div>;
}

function LoginPage() {
  return <div>Login Page</div>;
}

async function renderProtectedRoute(isAuthenticated = false) {
  useStore.setState({
    loading: false,
    isAuthenticated,
    user: isAuthenticated
      ? { id: "1", name: "Admin", email: "admin@test.com" }
      : null,
  });

  let result;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  });

  return result;
}

describe("ProtectedRoute Component", () => {
  it("should redirect to login when not authenticated", async () => {
    await renderProtectedRoute(false);

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should render protected content when authenticated", async () => {
    await renderProtectedRoute(true);

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});
