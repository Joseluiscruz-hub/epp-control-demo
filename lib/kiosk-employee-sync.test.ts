import assert from "node:assert/strict";
import test from "node:test";
import { buildKioskEmployeeSyncPayload } from "./kiosk-employee-sync";

test("sincroniza el centro de costos y los datos operativos del colaborador", () => {
  assert.deepEqual(
    buildKioskEmployeeSyncPayload(
      {
        name: "Ana Perez",
        area: "Produccion",
        plantaId: "sur",
        personnelArea: "Operaciones",
        plantArea: "Linea 1",
        costCenter: "PRODUCCION",
        position: "Operadora",
        jobFunction: "Envasado",
        active: true,
      },
      "norte"
    ),
    {
      name: "Ana Perez",
      area: "Produccion",
      plantaId: "sur",
      personnelArea: "Operaciones",
      plantArea: "Linea 1",
      costCenter: "PRODUCCION",
      position: "Operadora",
      jobFunction: "Envasado",
      active: true,
    }
  );
});

test("usa valores seguros cuando el snapshot tiene campos incompletos", () => {
  assert.deepEqual(buildKioskEmployeeSyncPayload({ area: "Almacen" }, "norte"), {
    name: "",
    area: "Almacen",
    plantaId: "norte",
    personnelArea: "",
    plantArea: "Almacen",
    costCenter: "",
    position: "",
    jobFunction: "",
    active: false,
  });
});
