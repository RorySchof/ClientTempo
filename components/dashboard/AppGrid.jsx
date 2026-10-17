"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, sectionHeaderBar } from "./theme";

const APPS = [
  {
    title: "Realtor Reply",
    href: "/manual-input",
    icon: "✉️",
    subtext: "Draft thoughtful replies to client emails.",
  },
  {
    title: "Showing Notes",
    href: "/showing-notes",
    icon: "📋",
    subtext: "Create polished client recaps from showing notes.",
  },
  {
    title: "Open House Notes",
    href: "/open-house-notes",
    icon: "🏠",
    subtext: "Create clear seller reports from visitor feedback.",
  },
  {
    title: "Listing Generator",
    href: "/listing-generator",
    icon: "📝",
    subtext: "Write polished listing descriptions from property notes.",
  },
  {
    title: "RealGPT",
    href: "/realgpt",
    icon: "💬",
    subtext: "Think through properties, clients, negotiations, and more.",
  },
];

const CARD_HEIGHT = "10.625rem";
const GRID_GAP = "1.75rem";

function AppCard({ app }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={app.href}
      style={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        border: `1px solid ${colors.hairline}`,
        borderRadius: "8px",
        background: hovered ? colors.bgMuted : colors.bg,
        overflow: "hidden",
        boxSizing: "border-box",
        width: "100%",
        height: CARD_HEIGHT,
        transition: "background 0.15s ease",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          ...sectionHeaderBar,
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.95rem 1.6rem",
          fontSize: "1.35rem",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "1.5rem", lineHeight: 1 }}>
          {app.icon}
        </span>
        <span>{app.title}</span>
      </div>
      <div
        style={{
          padding: "1.7rem 1.7rem",
          boxSizing: "border-box",
        }}
      >
        {app.subtext ? (
          <p
            style={{
              margin: 0,
              color: colors.slate,
              fontSize: "1.2rem",
              lineHeight: 1.5,
            }}
          >
            {app.subtext}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export default function AppGrid() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
        gap: GRID_GAP,
        width: "100%",
        alignItems: "stretch",
        boxSizing: "border-box",
      }}
    >
      {APPS.map((app, index) => {
        const isLast = index === APPS.length - 1;
        const centerLast = isLast && !isMobile && APPS.length % 2 === 1;

        return (
          <div
            key={app.href}
            style={{
              width: "100%",
              height: CARD_HEIGHT,
              ...(centerLast
                ? {
                    gridColumn: "1 / -1",
                    justifySelf: "center",
                    maxWidth: `calc((100% - ${GRID_GAP}) / 2)`,
                  }
                : null),
            }}
          >
            <AppCard app={app} />
          </div>
        );
      })}
    </section>
  );
}
