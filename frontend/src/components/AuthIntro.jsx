const HIGHLIGHTS = [
  {
    title: "Tavlan",
    text: "Varje ansökan på en rad — och vad som är dags idag.",
  },
  {
    title: "Annonser",
    text: "Platsbanken. Spara det du tänker söka.",
  },
  {
    title: "Profil & CV",
    text: "Ditt CV och vad som ska räknas i matchningen.",
  },
];

export default function AuthIntro() {
  return (
    <aside className="auth-intro" aria-label="Om Jobbsöket">
      <span className="section-kicker">Jobbsöket</span>
      <h2>
        Din tavla,
        <span className="grad"> inte en jobbsajt.</span>
      </h2>
      <p className="lede">
        Här håller du koll på dina egna ansökningar. Inget säljs till arbetsgivare.
        Du kan exportera eller radera allt när som helst.
      </p>
      <ul className="auth-intro-list">
        {HIGHLIGHTS.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <p className="auth-intro-foot muted">
        <a href="/">Läs mer på startsidan</a>
      </p>
    </aside>
  );
}
