import Link from "next/link";
import { colors } from "./theme";

const footerLinkStyle = {
  color: colors.slateLight,
  textDecoration: "none",
};

export default function FooterAccount() {
  return (
    <footer
      style={{
        marginTop: "2.5rem",
        paddingTop: "1.25rem",
        paddingBottom: "1.5rem",
        borderTop: `1px solid ${colors.hairline}`,
        textAlign: "center",
        color: colors.slateLight,
        fontSize: "0.85rem",
      }}
    >
      <p style={{ margin: 0 }}>© 2026 ClientTempo</p>
      <p style={{ margin: "0.4rem 0 0" }}>
        <Link href="/support" style={footerLinkStyle}>
          Support
        </Link>
        {" • "}
        <Link href="/terms" style={footerLinkStyle}>
          Terms
        </Link>
        {" • "}
        <Link href="/privacy" style={footerLinkStyle}>
          Privacy
        </Link>
      </p>
    </footer>
  );
}
