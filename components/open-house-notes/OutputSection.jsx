"use client";

// //OutputSection.jsx

// export default function OutputSection({ title, items = [] }) {
//   return (
//     <section style={styles.section}>
//       <h2 style={styles.title}>{title}</h2>
//       {items.length === 0 ? (
//         <p style={styles.empty}>None</p>
//       ) : (
//         <ul style={styles.list}>
//           {items.map((item, index) => (
//             <li key={`${title}-${index}`} style={styles.listItem}>
//               {item}
//             </li>
//           ))}
//         </ul>
//       )}
//     </section>
//   );
// }

// const styles = {
//   section: {
//     marginBottom: "1.25rem",
//   },
//   title: {
//     fontSize: "1rem",
//     fontWeight: 600,
//     marginBottom: "0.4rem",
//     color: "#111827",
//   },
//   list: {
//     margin: 0,
//     paddingLeft: "1.25rem",
//   },
//   listItem: {
//     marginBottom: "0.3rem",
//     lineHeight: 1.5,
//     color: "#374151",
//   },
//   empty: {
//     margin: 0,
//     color: "#6b7280",
//     fontStyle: "italic",
//   },
// };


// new code cursor

import { colors } from "./theme";

export default function OutputSection({ title, items = [], variant = "nested" }) {
  const isTopLevel = variant === "section";
  const Heading = isTopLevel ? "h3" : "h4";

  return (
    <section style={isTopLevel ? styles.topSection : styles.section}>
      <Heading style={isTopLevel ? styles.topTitle : styles.title}>{title}</Heading>
      {items.length === 0 ? (
        <p style={styles.empty}>None</p>
      ) : (
        <ul style={styles.list}>
          {items.map((item, index) => (
            <li key={`${title}-${index}`} style={styles.listItem}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const styles = {
  section: {
    marginBottom: "1.35rem",
  },
  topSection: {
    marginBottom: "1.5rem",
  },
  title: {
    fontSize: "0.92rem",
    fontWeight: 650,
    margin: "0 0 0.5rem",
    color: colors.ink,
  },
  topTitle: {
    fontSize: "1.02rem",
    fontWeight: 650,
    margin: "0 0 0.5rem",
    color: colors.navy,
  },
  list: {
    margin: 0,
    paddingLeft: "1.15rem",
  },
  listItem: {
    marginBottom: "0.3rem",
    lineHeight: 1.6,
    fontSize: "0.95rem",
    color: colors.slate,
  },
  empty: {
    margin: 0,
    color: colors.slateLight,
    fontStyle: "italic",
    fontSize: "0.9rem",
  },
};
