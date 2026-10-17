import type { ReactNode } from "react";
import { colors, type } from "@/components/dashboard/theme";

export const publicPageStyles = {
  page: {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.6,
    background: colors.bg,
  },
  header: {
    marginBottom: "1.75rem",
    paddingBottom: "1.25rem",
    borderBottom: `1px solid ${colors.hairline}`,
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
  section: {
    marginTop: "1.75rem",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: 650,
    margin: "0 0 0.5rem",
    color: colors.navy,
  },
  paragraph: {
    margin: "0 0 0.75rem",
    fontSize: "0.95rem",
  },
  list: {
    margin: "0 0 0.75rem",
    paddingLeft: "1.25rem",
    fontSize: "0.95rem",
    listStyle: "disc",
  },
  link: {
    color: colors.navy,
    textDecoration: "underline",
  },
};

export function PublicPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={publicPageStyles.page}>
      <header style={publicPageStyles.header}>
        <h1 style={publicPageStyles.title}>{title}</h1>
        {subtitle ? <p style={publicPageStyles.subtitle}>{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}

export function PublicSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={publicPageStyles.section}>
      <h2 style={publicPageStyles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}
