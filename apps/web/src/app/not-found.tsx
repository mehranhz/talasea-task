import messages from "../../messages/fa.json";

export default function NotFound() {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f7f3ea",
          color: "#241c14",
          fontFamily: "sans-serif",
        }}
      >
        {messages.errors.notFound}
      </body>
    </html>
  );
}
