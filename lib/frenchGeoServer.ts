// lib/frenchGeoServer.ts
// Partie server-only de frenchGeo.ts (lit un fichier local) — à n'importer
// que depuis getStaticProps/lib server-side, jamais depuis un composant de
// page (sinon `fs` se retrouve dans le bundle client et casse le build).
import fs from "fs";
import path from "path";

let _departmentNames: Map<string, string> | null = null;

export function getDepartmentNames(): Map<string, string> {
  if (_departmentNames) return _departmentNames;
  const filePath = path.join(process.cwd(), "public", "geo", "france-departements.geojson");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  _departmentNames = new Map(raw.features.map((f: any) => [f.properties.code, f.properties.nom]));
  return _departmentNames;
}
