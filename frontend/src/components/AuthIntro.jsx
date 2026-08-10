const HIGHLIGHTS = [
  {
    title: "Översikt",
    text: "Vad som ska sökas och vad som väntar på svar.",
  },
  {
    title: "Sparade & ansökningar",
    text: "Sparade jobb och sökta hålls isär — aldrig blandade.",
  },
  {
    title: "Annonser & CV",
    text: "Platsbanken plus matchning mot ditt CV.",
  },
];

export default function AuthIntro() {
  return (
    <aside className="auth-intro" aria-label="Om Jobbdjungeln">
      <span className="section-kicker">Jobbdjungeln</span>
      <h2>
        Dina ansökningar,
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
