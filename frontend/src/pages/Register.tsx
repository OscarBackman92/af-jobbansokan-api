import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { register as apiRegister } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

interface FormData { username: string; password1: string; password2: string }

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refetch } = useAuth();

  const onSubmit = async (data: FormData) => {
    setError("");
    setLoading(true);
    try {
      await apiRegister(data.username, data.password1, data.password2);
      await refetch();
      navigate("/dashboard");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: Record<string, string[]> } })?.response?.data;
      if (msg) {
        const first = Object.values(msg).flat()[0];
        setError(first ?? "Något gick fel. Försök igen.");
      } else {
        setError("Något gick fel. Försök igen.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-af-blue text-white font-bold text-xl shadow-lg">AF</div>
          <h1 className="text-2xl font-bold text-gray-900">Skapa konto</h1>
          <p className="mt-1 text-sm text-gray-500">Kom igång gratis på sekunder</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Användarnamn</label>
              <input
                {...register("username", { required: true, minLength: 3 })}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-af-blue focus:border-transparent ${errors.username ? "border-red-300" : "border-gray-200"}`}
                placeholder="välj ett användarnamn"
                autoFocus
              />
              {errors.username && <p className="mt-1 text-xs text-red-500">Minst 3 tecken</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lösenord</label>
              <input
                {...register("password1", { required: true, minLength: 8 })}
                type="password"
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-af-blue focus:border-transparent ${errors.password1 ? "border-red-300" : "border-gray-200"}`}
                placeholder="minst 8 tecken"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bekräfta lösenord</label>
              <input
                {...register("password2", { required: true, validate: (v) => v === watch("password1") || "Lösenorden matchar inte" })}
                type="password"
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-af-blue focus:border-transparent ${errors.password2 ? "border-red-300" : "border-gray-200"}`}
                placeholder="upprepa lösenordet"
              />
              {errors.password2 && <p className="mt-1 text-xs text-red-500">{errors.password2.message}</p>}
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
              {loading ? "Skapar konto…" : "Skapa konto"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Har du redan ett konto?{" "}
            <Link to="/login" className="font-medium text-af-blue hover:underline">Logga in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
