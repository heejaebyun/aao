export const metadata = {
  title: "AAO Root Experiments",
  description: "Internal experiment pages for testing root-to-profile source delegation.",
  robots: {
    index: false,
    follow: false,
  },
};

const experiments = [
  {
    slug: "root-link-only",
    title: "Root Experiment A",
    description: "Marketing copy plus one canonical link to /ai-profile.",
  },
  {
    slug: "root-min-facts",
    title: "Root Experiment B",
    description: "Marketing copy, minimal visible facts, and one canonical link to /ai-profile.",
  },
];

export default function ExperimentsIndexPage() {
  return (
    <main
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        maxWidth: "760px",
        margin: "0 auto",
        padding: "32px 20px 56px",
        lineHeight: 1.8,
        color: "#111827",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "14px" }}>AAO Root Experiments</h1>
      <p style={{ margin: "0 0 18px" }}>
        These pages exist to test whether a root page only needs to point at <code>/ai-profile</code>, or whether a small visible facts layer still helps.
      </p>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        {experiments.map((experiment) => (
          <li key={experiment.slug} style={{ marginBottom: 10 }}>
            <a href={`/experiments/${experiment.slug}`} style={{ color: "#2563eb" }}>
              <strong>{experiment.title}</strong>
            </a>{" "}
            — {experiment.description}
          </li>
        ))}
      </ul>
    </main>
  );
}
