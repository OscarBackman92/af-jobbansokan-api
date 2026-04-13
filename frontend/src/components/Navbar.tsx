import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        pathname === to
          ? "text-white"
          : "text-blue-100 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 bg-af-blue shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-af-yellow font-bold text-af-blue-dark text-sm">
              AF
            </span>
            <span className="font-bold text-white text-lg leading-tight">
              Jobbansökan
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6">
            {link("/jobs", "Lediga jobb")}
            {user && (
              user.is_employer
                ? link("/employer", "Arbetsgivarpanel")
                : link("/dashboard", "Mina ansökningar")
            )}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden sm:block text-sm text-blue-100">
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                >
                  Logga ut
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-blue-100 hover:text-white transition-colors"
                >
                  Logga in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-af-yellow px-4 py-1.5 text-sm font-semibold text-af-blue-dark hover:bg-af-yellow-dark transition-colors"
                >
                  Skapa konto
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
