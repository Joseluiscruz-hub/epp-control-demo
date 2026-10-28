/** Aprobadores ficticios para pruebas; los reales llegan por KIOSK_ALERT_APPROVERS. */
export const KIOSK_APPROVERS_FIXTURE = {
  plants: {
    norte: [
      { employeeId: "1000001", name: "Aprobador Uno", email: "aprobador.uno@example.com" },
      { employeeId: "1000002", name: "Aprobador Dos", email: "aprobador.dos@example.com" },
      { employeeId: "1000003", name: "Aprobador Tres", email: "aprobador.tres@example.com" },
      { employeeId: "1000004", name: "Aprobador Cuatro", email: "aprobador.cuatro@example.com" },
    ],
  },
  global: [{ name: "Administrador global", email: "admin.global@example.com" }],
};

export function installKioskApproversFixture() {
  process.env.KIOSK_ALERT_APPROVERS = JSON.stringify(KIOSK_APPROVERS_FIXTURE);
}
