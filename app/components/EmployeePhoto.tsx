"use client";

import { useState, type ReactNode } from "react";

/**
 * The employee's photo in SmartHR. `/ata/` finds every company's employees, so the company is not
 * part of the address. The code goes in as stored, dash included (1290-000123).
 */
export const employeePhotoUrl = (employeeCode: string | null | undefined) => {
  const code = employeeCode?.trim();
  return code ? `https://smarthr.attg.co.th/ata/index.php/image/viewPhoto?EmpCode=${encodeURIComponent(code)}` : null;
};

/**
 * Fills its (round, sized) parent with the photo, or shows `fallback` - the initials the parent
 * already showed - when there is no code, SmartHR cannot be reached, or it answers "not found"
 * (a JSON text, which the browser cannot decode as an image, so onError fires).
 */
export default function EmployeePhoto({ employeeCode, fallback }: { employeeCode: string | null | undefined; fallback: ReactNode }) {
  const url = employeePhotoUrl(employeeCode);
  // Keyed on the address, so another person's photo gets its own try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an external photo service; next/image would need its domain configured and proxies the bytes through our server
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
      // SmartHR photos are upright portraits; centring the crop in a circle shows the chest, so the
      // square is taken from the top, where the face is.
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", borderRadius: "inherit", display: "block" }}
    />
  );
}
