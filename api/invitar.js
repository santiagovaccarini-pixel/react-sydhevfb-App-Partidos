import { atenderInvitar } from "../lib/invitacionMail.js";

export const config = {
  maxDuration: 30,
};

// POST { invitacion, idioma }: manda (o reenvía) el mail de una invitación a
// un club, al correo de esa invitación. La lógica y las reglas están en
// lib/invitacionMail.js.
export default function handler(request, response) {
  return atenderInvitar(request, response);
}
