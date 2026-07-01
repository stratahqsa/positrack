export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 640, textAlign: "center" }}>
        <div
          style={{
            fontSize: 13,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#38bdf8",
            marginBottom: 12,
          }}
        >
          Posibolt · PXB1 Beta Phase 1
        </div>
        <h1 style={{ fontSize: 40, margin: "0 0 12px", fontWeight: 800 }}>
          POSX Control Tower
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: "#94a3b8",
            margin: "0 0 24px",
          }}
        >
          The live project control tower is being provisioned. Epic
          accountability, RED-gap flags, true logged-time by person, and board
          hygiene will appear here — always current, one URL.
        </p>
        <div
          style={{
            display: "inline-block",
            padding: "8px 16px",
            borderRadius: 999,
            background: "#1e293b",
            color: "#cbd5e1",
            fontSize: 13,
          }}
        >
          ⚙️ Building overnight — check back soon
        </div>
      </div>
    </main>
  );
}
