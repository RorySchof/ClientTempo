import { colors, type } from "./theme";

export const pageStyles = {
  page: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.5,
    background: colors.bg,
    width: "100%",
    boxSizing: "border-box",
    minHeight: "calc(100dvh - 10rem)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  header: {
    marginBottom: "1.75rem",
    paddingBottom: "1.25rem",
    borderBottom: `1px solid ${colors.hairline}`,
    textAlign: "center",
  },
  title: {
    fontSize: "1.6rem",
    fontWeight: 650,
    margin: 0,
    color: colors.navy,
    letterSpacing: "-0.01em",
  },
  subtitle: {
    margin: "0.35rem 0 0",
    color: colors.slate,
    fontSize: "0.95rem",
  },
  status: {
    color: colors.slate,
  },
  error: {
    color: colors.danger,
  },
};
