// src/dashboard/Dashboard.jsx

import Header from "./Header";
import AppGrid from "./AppGrid";
import { pageStyles } from "./pageStyles";

export default function Dashboard() {
  return (
    <div style={pageStyles.page}>
      <Header />
      <AppGrid />
    </div>
  );
}
