# Correos de la app (plantillas de Supabase)

Los mails los manda Supabase Auth con el SMTP propio del proyecto, con un solo
remitente ("ARK") para todos los clubes. El texto de cada uno se pega a mano en
Supabase › Authentication › Emails › Templates: el asunto en "Subject" y el
contenido del archivo en el cuerpo (pestaña de código/HTML). Primero en
castellano y después en portugués. No llevan datos del club ni claves.

| Plantilla de Supabase | Asunto | Archivo |
| --- | --- | --- |
| Invite user | `Tu invitación a ARK · Seu convite para o ARK` | [invitar.html](invitar.html) |
| Confirm signup | `Confirmá tu correo en ARK · Confirme seu e-mail no ARK` | [confirmar-correo.html](confirmar-correo.html) |
| Reset password | `Tu contraseña de ARK · Sua senha do ARK` | [recuperar-contrasena.html](recuperar-contrasena.html) |
| Change email address | `Confirmá tu correo nuevo en ARK · Confirme seu novo e-mail no ARK` | [cambiar-correo.html](cambiar-correo.html) |

- El botón usa `{{ .ConfirmationURL }}`: el enlace que arma Supabase, que vuelve a
  la app (la invitación, a `/?invitacion=1`; recuperar la contraseña, a
  `/?training_recovery=1`).
- La invitación nombra el club con `{{ .Data.club }}` (lo pone el servidor al
  mandarla, `lib/invitacionMail.js`). Si no viene, dice "un club en ARK".
- Los textos dicen que el enlace vence en 24 horas: es el valor de
  Authentication › Sign In / Providers › Email › "Email OTP Expiration" =
  `86400` (el máximo que deja el panel). Si se cambia ese valor, cambiar también
  el texto de las cuatro plantillas.
- Se comprobó que las cuatro se arman sin error con el mismo motor de plantillas
  que usa Supabase (Go `html/template`), con club, sin club y sin datos.
