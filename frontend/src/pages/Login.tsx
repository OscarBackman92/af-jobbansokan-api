import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { login } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

interface FormData { username: string; password: string }

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refetch } = useAuth();

  const onSubmit = async (data: FormData) => {
    setError("");
    setLoading(true);
    try {
      await login(data.username, data.password);
      await refetch();
      navigate("/dashboard");
    } catch {
      setError("Fel användarnamn eller lösenord.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-af-blue text-white font-bold text-xl shadow-lg">AF</div>
          <h1 className="text-2xl font-bold text-gray-900">Logga in</h1>
          <p className="mt-1 text-sm text-gray-500">Välkommen tillbaka</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Användarnamn</label>
              <input
                {...register("username", { required: true })}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-af-blue focus:border-transparent ${errors.username ? "border-red-300" : "border-gray-200"}`}
                placeholder="ditt användarnamn"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lösenord</label>
              <input
                {...register("password", { required: true })}
                type="password"
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-af-blue focus:border-transparent ${errors.password ? "border-red-300" : "border-gray-200"}`}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-af-blue py-3 text-sm font-semibold text-white hover:bg-af-blue-dark disabled:opacity-60 transition-colors shadow-sm"
            >
              {loading ? "Loggar in…" : "Logga in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Inget konto?{" "}
            <Link to="/register" className="font-medium text-af-blue hover:underline">Skapa ett gratis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
