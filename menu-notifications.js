'use strict';

async function setupMenuNotifications() {
  const button = document.getElementById('guest-notifications');
  const status = document.getElementById('guest-notifications-status');
  try {
    const response = await fetch('menu-notifications-config.json', { cache: 'no-store' });
    if (!response.ok) return;
    const { appId } = await response.json();
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(appId || '')) return;

    const worker = new URL('OneSignalSDKWorker.js', location.href);
    const scope = new URL('./', worker).pathname;
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async oneSignal => {
      try {
        await oneSignal.init({
          appId,
          serviceWorkerPath: worker.pathname,
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
            if (subscription.optedIn) await subscription.optOut();
            else await subscription.optIn();
            refresh();
            status.textContent = subscription.optedIn ? 'Upozornenia sú zapnuté.' : 'Upozornenia sú vypnuté.';
          } catch {
            status.textContent = 'Upozornenia sa nepodarilo zmeniť. Skontroluj povolenie oznámení.';
          } finally {
            button.disabled = false;
          }
        };
      } catch {
        button.hidden = true;
      }
    });
    document.head.append(script);
  } catch {
    // The guest menu remains usable while notifications are unavailable.
  }
}

setupMenuNotifications();
