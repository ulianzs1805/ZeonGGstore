export const metadata = { title: "Пользовательское соглашение | ZeonGGStore" };

const sections: Array<[string, string[]]> = [
  ["1. Общие положения", [
    "Настоящее Пользовательское соглашение регулирует использование платформы ZeonGGStore, включая сайт, личный кабинет, кейсы, бонусы, промокоды, Z-Coin, Upgrader, Tower и иные доступные функции.",
  ]],
];

export default function AgreementPage() {
  return (
    <main>
      <div className="mt-8 space-y-8">
        {sections.map(([title, paragraphs]) => (
          <section key={String(title)}>
            <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-700">
              {paragraphs.map((paragraph, index) => (
                <p key={`${title}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
