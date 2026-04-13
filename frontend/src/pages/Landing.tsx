import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const features = [
  {
    icon: "📋",
    title: "Spåra ansökningar",
    desc: "Håll koll på alla dina jobbansökningar på ett ställe. Se statusen i realtid.",
  },
  {
    icon: "🔍",
    title: "Hitta lediga jobb",
    desc: "Bläddra och sök bland lediga tjänster. Ansök direkt med ett klick.",
  },
  {
    icon: "✅",
    title: "Verifierbart",
    desc: "Dina ansökningar registreras säkert och kan delas med Arbetsförmedlingen och A-kassa.",
  },
  {
    icon: "🔒",
    title: "Säkert & privat",
    desc: "Dina uppgifter skyddas enligt GDPR. Du bestämmer vem som ser vad.",
  },
];

const steps = [
  { n: "01", title: "Skapa konto", desc: "Registrera dig gratis på sekunder." },
  { n: "02", title: "Sök jobb", desc: "Bläddra bland lediga tjänster och ansök." },
  { n: "03", title: "Följ upp", desc: "Spåra statusen på alla dina ansökningar." },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-af-blue via-af-blue-dark to-[#002F4A] py-24 sm:py-32">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-af-yellow/10" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-af-yellow/20 px-4 py-1.5 text-sm font-semibold text-af-yellow mb-6">
              <span className="h-2 w-2 rounded-full bg-af-yellow animate-pulse" />
              Arbetsförmedlingen · Digitalt
            </span>
          </div>

          <h1 className="animate-slide-up mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Dina jobbansökningar
            <br />
            <span className="text-af-yellow">på ett ställe.</span>
          </h1>

          <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-blue-100 sm:text-xl">
            Registrera, spåra och dela dina jobbansökningar enkelt och säkert.
            Alltid redo för Arbetsförmedlingen och A-kassa.
          </p>

          <div className="animate-slide-up mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link
                to={user.is_employer ? "/employer" : "/dashboard"}
                className="rounded-xl bg-af-yellow px-8 py-4 text-base font-bold text-af-blue-dark shadow-lg hover:bg-af-yellow-dark transition-all hover:-translate-y-0.5"
              >
                Gå till din panel →
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="rounded-xl bg-af-yellow px-8 py-4 text-base font-bold text-af-blue-dark shadow-lg hover:bg-af-yellow-dark transition-all hover:-translate-y-0.5"
                >
                  Kom igång gratis
                </Link>
                <Link
                  to="/jobs"
                  className="rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white hover:bg-white/20 transition-all hover:-translate-y-0.5"
                >
                  Se lediga jobb
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Allt du behöver</h2>
            <p className="mt-4 text-lg text-gray-500">Enkelt, säkert och byggt för svenska jobbsökare.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100 hover:shadow-md hover:-translate-y-1 transition-all"
              >
                <div className="mb-4 text-4xl">{f.icon}</div>
                <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Så här fungerar det</h2>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px bg-gray-200" />
            <div className="grid gap-10 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="flex flex-col items-center text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-af-blue text-white font-bold text-xl shadow-lg mb-5">
                    {s.n}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="bg-af-blue py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Redo att komma igång?</h2>
            <p className="mt-4 text-lg text-blue-100">Skapa ett gratis konto och börja spåra dina ansökningar idag.</p>
            <Link
              to="/register"
              className="mt-8 inline-block rounded-xl bg-af-yellow px-10 py-4 text-base font-bold text-af-blue-dark hover:bg-af-yellow-dark transition-all hover:-translate-y-0.5 shadow-lg"
            >
              Skapa gratis konto →
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} AF Jobbansökan · Arbetsförmedlingen
        </div>
      </footer>
    </div>
  );
}
