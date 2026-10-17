import { pageStyles } from "./pageStyles";

export default function Header() {
  return (
    <header style={pageStyles.header}>
      <h1
        style={{
          ...pageStyles.title,
          fontSize: "2.65rem",
        }}
      >
        ClientTempo Workspace
      </h1>
      <p
        style={{
          ...pageStyles.subtitle,
          margin: "0.5rem 0 0",
          fontSize: "1.25rem",
        }}
      >
        Tools for the everyday work of being a realtor.
      </p>
    </header>
  );
}
