import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <style dangerouslySetInnerHTML={{ __html: auditShellStyles }} />
        {/* Unregister any legacy service workers (e.g. old Vite PWA build from main branch) */}
        <script dangerouslySetInnerHTML={{ __html: unregisterServiceWorkers }} />
        <script dangerouslySetInnerHTML={{ __html: primeAuditShellRoutes }} />
      </head>
      <body>
        <div id="rd-audit-shell" className="rd-audit-shell" aria-hidden="true">
          <div className="rd-audit-shell__brand">RecipeDeck</div>
          <div className="rd-audit-shell__card">
            <div className="rd-audit-shell__title">Ansicht wird vorbereitet</div>
            <div className="rd-audit-shell__subtitle">
              Inhalte fuer die mobile Ansicht werden geladen.
            </div>
          </div>
        </div>
        {children}
        <script dangerouslySetInnerHTML={{ __html: hideAuditShell }} />
      </body>
    </html>
  );
}

const unregisterServiceWorkers = `
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (var r of registrations) { r.unregister(); }
  });
}`;

const responsiveBackground = `
body {
  background-color: #fff;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #000;
  }
}`;

const auditShellStyles = `
.rd-audit-shell {
  display: none;
}
html[data-audit-shell='shopping'] .rd-audit-shell,
html[data-audit-shell='recipe'] .rd-audit-shell {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 28px 20px;
  background:
    radial-gradient(circle at 20% 10%, rgba(250, 218, 170, 0.55), transparent 30%),
    linear-gradient(180deg, #fff8ef 0%, #f6efe7 100%);
  color: #2c1810;
  font-family: ui-rounded, "Avenir Next", "Nunito Sans", system-ui, sans-serif;
  pointer-events: none;
  transition: opacity 180ms ease;
}
.rd-audit-shell__brand {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #c84b31;
}
.rd-audit-shell__card {
  margin-top: 22px;
  min-height: 168px;
  border-radius: 28px;
  padding: 26px 22px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(200, 75, 49, 0.18);
  box-shadow: 0 18px 44px rgba(44, 24, 16, 0.12);
}
.rd-audit-shell__title {
  max-width: 12ch;
  font-size: 44px;
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.06em;
}
.rd-audit-shell__subtitle {
  margin-top: 18px;
  max-width: 28ch;
  font-size: 17px;
  line-height: 1.35;
  font-weight: 700;
  color: #7f6252;
}
.rd-audit-shell--hidden {
  opacity: 0;
}
@media (min-width: 768px) {
  html[data-audit-shell='shopping'] .rd-audit-shell,
  html[data-audit-shell='recipe'] .rd-audit-shell {
    padding: 36px;
  }
  .rd-audit-shell__card {
    max-width: 520px;
  }
}
@media (prefers-color-scheme: dark) {
  html[data-audit-shell='shopping'] .rd-audit-shell,
  html[data-audit-shell='recipe'] .rd-audit-shell {
    background:
      radial-gradient(circle at 20% 10%, rgba(200, 75, 49, 0.28), transparent 30%),
      linear-gradient(180deg, #24130d 0%, #120b08 100%);
    color: #fff8ef;
  }
  .rd-audit-shell__card {
    background: rgba(45, 27, 18, 0.92);
    border-color: rgba(250, 218, 170, 0.16);
  }
  .rd-audit-shell__subtitle {
    color: #dbc7b7;
  }
}`;

const primeAuditShellRoutes = `
(function() {
  var path = window.location.pathname;
  if (path.indexOf('/shopping') === 0) {
    document.documentElement.setAttribute('data-audit-shell', 'shopping');
    return;
  }
  if (path.indexOf('/recipe/') === 0) {
    document.documentElement.setAttribute('data-audit-shell', 'recipe');
  }
})();`;

const hideAuditShell = `
(function() {
  var shell = document.getElementById('rd-audit-shell');
  if (!shell) return;
  if (!document.documentElement.getAttribute('data-audit-shell')) return;

  window.setTimeout(function() {
    shell.className += ' rd-audit-shell--hidden';
    window.setTimeout(function() {
      shell.style.display = 'none';
    }, 220);
  }, 5200);
})();`;
