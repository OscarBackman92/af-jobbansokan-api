const HIGHLIGHTS = [
  {
    title: "Tavlan",
    text: "Se vad som pågår och vad som behöver en ping idag.",
  },
  {
    title: "Annonser",
    text: "Sök Platsbanken och spara jobb du vill söka.",
  },
  {
    title: "Profil & CV",
    text: "CV och matchning utifrån det du själv markerat som sant.",
  },
];

export default function AuthIntro() {
  return (
    <aside className="auth-intro" aria-label="Om Jobbsöket">
      <span className="section-kicker">Hej</span>
      <h2>
        En tavla för
        <span className="grad"> dina jobbansökningar.</span>
      </h2>
      <p className="lede">
        Jobbsöket är inte en rekryteringssajt — bara din egen översikt. Du äger
        uppgifterna och kan exportera eller radera kontot när som helst.
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
        <a href="/">Mer om hur det funkar</a>
      </p>
    </aside>
  );
}
