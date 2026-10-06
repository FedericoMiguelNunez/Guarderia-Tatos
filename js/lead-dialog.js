// Shared markup: keep one form instance per page.
export function mountLeadDialog() {
  if (document.querySelector("#consulta")) return;
  document.body.insertAdjacentHTML("beforeend", `
      <div class="lead-dialog" id="consulta" role="dialog" aria-modal="true" aria-labelledby="lead-title" data-whatsapp-number="5491135942796" hidden>
        <div class="lead-dialog-backdrop" data-lead-close aria-hidden="true"></div>
        <section class="lead-card" tabindex="-1">
          <button class="lead-close" type="button" data-lead-close aria-label="Cerrar formulario">&times;</button>
          <div class="lead-intro">
            <h2 id="lead-title">¡Contanos por quién consultás!</h2>
            <p>Dejanos estos datos y seguimos por WhatsApp.</p>
          </div>
          <form id="lead-form" novalidate>
            <div class="lead-fields">
              <div class="lead-field">
                <label for="lead-name">Tu nombre</label>
                <input id="lead-name" name="name" type="text" autocomplete="name" maxlength="100" required aria-describedby="lead-name-error">
                <span class="lead-error" id="lead-name-error" aria-live="polite"></span>
              </div>
              <div class="lead-field">
                <label for="lead-cat">Nombre de tu gato</label>
                <input id="lead-cat" name="catName" type="text" maxlength="160" required aria-describedby="lead-cat-error">
                <span class="lead-error" id="lead-cat-error" aria-live="polite"></span>
              </div>
              <div class="lead-field">
                <label for="lead-phone">Tu número de WhatsApp</label>
                <input id="lead-phone" name="phone" type="tel" autocomplete="tel-national" inputmode="tel" maxlength="40" required aria-describedby="lead-phone-help lead-phone-error">
                <small id="lead-phone-help">Incluí el código de área (por ejemplo, 11): 11 2345-6789 o 011 15 2345-6789. No hace falta el código de país.</small>
                <span class="lead-error" id="lead-phone-error" aria-live="polite"></span>
              </div>
            </div>
            <div class="lead-honeypot" aria-hidden="true">
              <label for="lead-website">No completar este campo</label>
              <input id="lead-website" name="website" type="text" tabindex="-1" autocomplete="off">
            </div>
            <button class="Beneficio-titulo_btn lead-submit" type="submit">Continuar a WhatsApp</button>
            <div class="lead-status" id="lead-status" role="status" aria-live="polite"></div>
          </form>
        </section>
      </div>
  `);
}
