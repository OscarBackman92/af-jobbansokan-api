const HIGHLIGHTS = [
  {
    title: "Tavlan",
    text: "Pipeline, påminnelser och export — se vad som händer idag.",
  },
  {
    title: "Annonser",
    text: "Platsbanken live. Spara jobb på tavlan med ett klick.",
  },
  {
    title: "Profil & CV",
    text: "Bevisprofiler och matchning som visar varför en annons passar.",
  },
];

export default function AuthIntro() {
  return (
    <aside className="auth-intro" aria-label="Om Jobbsöket">
      <span className="section-kicker">Välkommen</span>
      <h2>
        Ditt jobbsök,
        <span className="grad"> samlat och tydligt.</span>
      </h2>
      <p className="lede">
        Jobbsöket är en personlig ansökningstavla — inte en rekryteringstjänst.
        Du äger datan, exporterar när du vill och raderar kontot utan krångel.
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
