'use strict';

async function setupMenuNotifications() {
  const button = document.getElementById('guest-notifications');
  const status = document.getElementById('guest-notifications-status');
  button.onclick = () => {
    status.hidden = false;
    status.textContent = 'Upozornenia sa ešte pripájajú. Skús znova o chvíľu.';
  };
  const unavailable = () => {
    button.onclick = () => {
      status.hidden = false;
      status.textContent = 'Upozornenia sa nepodarilo pripojiť. Skús zavrieť a znova otvoriť menu cez ikonu na ploche.';
    };
  };
  if (!(('PushSubscriptionOptions' in window &&
         Object.hasOwn(PushSubscriptionOptions.prototype, 'applicationServerKey')) || window.safari?.pushNotification)) {
    button.onclick = () => {
      status.hidden = false;
      status.textContent = /iPhone|iPad/.test(navigator.userAgent)
        ? 'Otvor menu cez ikonu U Mastina na ploche iPhonu.'
        : 'Tento prehliadač nepodporuje webové upozornenia.';
    };
    return;
  }
  try {
    const response = await fetch('menu-notifications-config.json', { cache: 'no-store' });
    if (!response.ok) return unavailable();
    const { appId } = await response.json();
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(appId || '')) return unavailable();

    const worker = new URL('OneSignalSDKWorker.js', location.href);
    const scope = new URL('./', worker).pathname;
    const script = document.createElement('script');
    script.onerror = unavailable;
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async oneSignal => {
      try {
        await oneSignal.init({
          appId,
          // Typical Site otherwise uses the dashboard's root worker path.
          serviceWorkerOverrideForTypical: true,
          path: scope,
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          serviceWorkerParam: { scope },
          notifyButton: { enable: false },
          welcomeNotification: { disable: true }
        });
        const subscription = oneSignal.User.PushSubscription;
        const refresh = () => {
          button.textContent = subscription.optedIn ? 'Vypnúť upozornenia' : 'Upozorniť na nové menu';
        };
        subscription.addEventListener('change', refresh);
        refresh();
        button.hidden = false;
        button.onclick = async () => {
          status.hidden = false;
          if (!oneSignal.Notifications.isPushSupported()) {
            status.textContent = /iPhone|iPad/.test(navigator.userAgent) ?
              'Pridaj menu na plochu a upozornenia zapni cez jeho ikonu.' :
              'Na tomto zariadení prehliadač upozornenia nepodporuje.';
            return;
          }
          button.disabled = true;
          try {
            const wasSubscribed = subscription.optedIn;
            if (wasSubscribed) await subscription.optOut();
            else await subscription.optIn();
            refresh();
            if (!wasSubscribed && !subscription.optedIn && !oneSignal.Notifications.permission) {
              status.textContent = 'Upozornenia zatiaľ nie sú povolené. Povoľ oznámenia pre menu na telefóne.';
              return;
            }
            status.textContent = subscription.optedIn ? 'Upozornenia sú zapnuté.' : 'Upozornenia sú vypnuté.';
          } catch {
            status.textContent = 'Upozornenia sa nepodarilo zmeniť. Skontroluj povolenie oznámení.';
          } finally {
            button.disabled = false;
          }
        };
      } catch {
        unavailable();
      }
    });
    document.head.append(script);
  } catch {
    unavailable();
  }
}

setupMenuNotifications();
