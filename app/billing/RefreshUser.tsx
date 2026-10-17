"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

export default function RefreshUser() {
  const { user } = useUser();
  const refreshed = useRef(false);

  useEffect(() => {
    if (!user || refreshed.current) return;
    refreshed.current = true;
    void user.reload();
  }, [user]);

  return null;
}
